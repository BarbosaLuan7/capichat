import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestMessagePayload {
  whatsapp_instance_id: string;
  phone: string;
}

// Normaliza URL removendo barras finais
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// Tenta fazer request com múltiplos formatos de auth para WAHA
async function wahaFetch(
  url: string, 
  apiKey: string, 
  options: RequestInit = {}
): Promise<Response> {
  const authFormats: Array<{ name: string; headers: Record<string, string> }> = [
    { name: 'X-Api-Key', headers: { 'X-Api-Key': apiKey } },
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'ApiKey (sem Bearer)', headers: { 'Authorization': apiKey } },
  ];

  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (const authFormat of authFormats) {
    try {
      console.log(`[WAHA] Tentando ${options.method || 'GET'} ${url} com ${authFormat.name}`);
      
      const mergedHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
        ...authFormat.headers,
      };
      
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      console.log(`[WAHA] ${authFormat.name} - Status: ${response.status}`);

      if (response.ok || response.status !== 401) {
        return response;
      }
      
      lastResponse = response;
      console.log(`[WAHA] ${authFormat.name} - Unauthorized, tentando próximo...`);
      
    } catch (error: unknown) {
      console.error(`[WAHA] ${authFormat.name} - Erro:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('Todos os formatos de autenticação falharam');
}

// Interface para config do WhatsApp
interface WhatsAppConfig {
  id: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name: string | null;
  name: string;
}

// Envia mensagem via WAHA
async function sendWAHA(
  config: WhatsAppConfig, 
  phone: string, 
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const session = config.instance_name || 'default';
  const chatId = `${phone}@c.us`;
  
  const url = `${baseUrl}/api/sendText`;
  const body = {
    chatId,
    text: message,
    session,
  };

  console.log('[WAHA] Enviando mensagem de teste:', { url, chatId, session });

  try {
    const response = await wahaFetch(url, config.api_key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('[WAHA] Resposta:', response.status, responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        return { success: false, error: errorData.message || errorData.error || `Erro ${response.status}` };
      } catch {
        return { success: false, error: `Erro ${response.status}: ${responseText}` };
      }
    }

    const data = JSON.parse(responseText);
    return { success: true, messageId: data.id || data.messageId };
  } catch (error: unknown) {
    console.error('[WAHA] Erro ao enviar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

// Envia mensagem via Evolution API
async function sendEvolution(
  config: WhatsAppConfig, 
  phone: string, 
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const instanceName = config.instance_name || 'default';
  
  const url = `${baseUrl}/message/sendText/${instanceName}`;
  const body = {
    number: phone,
    text: message,
  };

  console.log('[Evolution] Enviando mensagem de teste:', { url, phone });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': config.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('[Evolution] Resposta:', response.status, responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        return { success: false, error: errorData.message || `Erro ${response.status}` };
      } catch {
        return { success: false, error: `Erro ${response.status}: ${responseText}` };
      }
    }

    const data = JSON.parse(responseText);
    return { success: true, messageId: data.key?.id };
  } catch (error: unknown) {
    console.error('[Evolution] Erro ao enviar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

// Envia mensagem via Z-API
async function sendZAPI(
  config: WhatsAppConfig, 
  phone: string, 
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  
  const url = `${baseUrl}/send-text`;
  const body = {
    phone,
    message,
  };

  console.log('[Z-API] Enviando mensagem de teste:', { url, phone });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Client-Token': config.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('[Z-API] Resposta:', response.status, responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        return { success: false, error: errorData.message || `Erro ${response.status}` };
      } catch {
        return { success: false, error: `Erro ${response.status}: ${responseText}` };
      }
    }

    const data = JSON.parse(responseText);
    return { success: true, messageId: data.messageId };
  } catch (error: unknown) {
    console.error('[Z-API] Erro ao enviar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get user auth from request
    const authHeader = req.headers.get('Authorization');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: TestMessagePayload = await req.json();
    console.log('[whatsapp-test-message] Payload:', payload);

    if (!payload.whatsapp_instance_id || !payload.phone) {
      return new Response(
        JSON.stringify({ error: 'whatsapp_instance_id e phone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normaliza telefone (remove caracteres não numéricos, adiciona 55 se necessário)
    let phone = payload.phone.replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone;
    }

    // Buscar configuração completa (com api_key) usando service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: config, error: configError } = await supabaseAdmin
      .from('whatsapp_config')
      .select('id, provider, base_url, api_key, instance_name, name')
      .eq('id', payload.whatsapp_instance_id)
      .single();

    if (configError || !config) {
      console.error('[whatsapp-test-message] Config não encontrada:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração WhatsApp não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[whatsapp-test-message] Config encontrada:', config.name, config.provider);

    // Mensagem de teste
    const testMessage = `🔔 *Teste de Conexão - GaranteDireito CRM*\n\nMensagem enviada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\nInstância: ${config.name}`;

    let result: { success: boolean; messageId?: string; error?: string };

    switch (config.provider) {
      case 'waha':
        result = await sendWAHA(config as WhatsAppConfig, phone, testMessage);
        break;
      case 'evolution':
        result = await sendEvolution(config as WhatsAppConfig, phone, testMessage);
        break;
      case 'z-api':
        result = await sendZAPI(config as WhatsAppConfig, phone, testMessage);
        break;
      default:
        result = { success: false, error: `Provider '${config.provider}' não suportado para teste` };
    }

    console.log('[whatsapp-test-message] Resultado:', result);

    return new Response(
      JSON.stringify({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        instance: config.name,
        phone,
      }),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[whatsapp-test-message] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
