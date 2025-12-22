import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessagePayload {
  conversation_id: string;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
}

interface WhatsAppConfig {
  id: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name: string | null;
}

// Normaliza URL removendo barras finais
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// Normaliza telefone para envio (adiciona código do país 55 se necessário)
function normalizePhoneForSending(phone: string): string {
  // Remove tudo que não é número
  let numbers = phone.replace(/\D/g, '');
  
  // Se não tem 55 no início, adiciona
  if (!numbers.startsWith('55') && numbers.length >= 10 && numbers.length <= 11) {
    numbers = '55' + numbers;
  }
  
  return numbers;
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

// Provider-specific message sending functions
async function sendWAHA(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const normalizedPhone = normalizePhoneForSending(phone);
  const chatId = normalizedPhone + '@c.us';
  const session = config.instance_name || 'default';
  
  let endpoint = '/api/sendText';
  let body: Record<string, unknown> = {
    chatId,
    text: message,
    session,
  };

  if (type === 'image' && mediaUrl) {
    endpoint = '/api/sendImage';
    body = {
      chatId,
      file: { url: mediaUrl },
      caption: message,
      session,
    };
  } else if (type === 'audio' && mediaUrl) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: mediaUrl },
      session,
    };
  } else if (type === 'document' && mediaUrl) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: mediaUrl },
      caption: message,
      session,
    };
  }

  const url = `${baseUrl}${endpoint}`;
  console.log('[WAHA] Enviando mensagem:', { url, chatId, session, type });

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
        
        // Detectar erro de versão Plus do WAHA
        if (responseText.includes('Plus version') || responseText.includes('GOWS')) {
          const mediaTypeLabel = type === 'audio' ? 'áudio' : type === 'image' ? 'imagens' : type === 'video' ? 'vídeos' : 'arquivos';
          return { 
            success: false, 
            error: `Envio de ${mediaTypeLabel} não suportado na versão gratuita do WAHA com engine GOWS. Altere o engine para WEBJS ou faça upgrade para WAHA Plus.` 
          };
        }
        
        return { success: false, error: errorData.message || `Erro ${response.status}` };
      } catch {
        return { success: false, error: `Erro ${response.status}: ${responseText}` };
      }
    }

    try {
      const data = JSON.parse(responseText);
      return { success: true, messageId: data.id || data.key?.id };
    } catch {
      return { success: true, messageId: undefined };
    }
  } catch (error: unknown) {
    console.error('[WAHA] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendEvolution(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const number = normalizePhoneForSending(phone);
  const instance = config.instance_name || 'default';
  
  let endpoint = `/message/sendText/${instance}`;
  let body: Record<string, unknown> = {
    number,
    text: message,
  };

  if (type === 'image' && mediaUrl) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'image',
      media: mediaUrl,
      caption: message,
    };
  } else if (type === 'audio' && mediaUrl) {
    endpoint = `/message/sendWhatsAppAudio/${instance}`;
    body = {
      number,
      audio: mediaUrl,
    };
  } else if (type === 'document' && mediaUrl) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'document',
      media: mediaUrl,
      caption: message,
    };
  }

  try {
    console.log('[Evolution] Enviando mensagem:', { baseUrl, endpoint, number });
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Evolution] Resposta:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.key?.id };
  } catch (error: unknown) {
    console.error('[Evolution] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendZAPI(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const phoneNumber = normalizePhoneForSending(phone);
  
  let endpoint = '/send-text';
  let body: Record<string, unknown> = {
    phone: phoneNumber,
    message: message,
  };

  if (type === 'image' && mediaUrl) {
    endpoint = '/send-image';
    body = {
      phone: phoneNumber,
      image: mediaUrl,
      caption: message,
    };
  } else if (type === 'audio' && mediaUrl) {
    endpoint = '/send-audio';
    body = {
      phone: phoneNumber,
      audio: mediaUrl,
    };
  } else if (type === 'document' && mediaUrl) {
    endpoint = '/send-document';
    body = {
      phone: phoneNumber,
      document: mediaUrl,
    };
  }

  try {
    console.log('[Z-API] Enviando mensagem:', { baseUrl, endpoint, phone: phoneNumber });
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Z-API] Resposta:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.messageId };
  } catch (error: unknown) {
    console.error('[Z-API] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendCustom(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  
  try {
    console.log('[Custom] Enviando mensagem:', { baseUrl });
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        phone,
        message,
        type: type || 'text',
        media_url: mediaUrl,
      }),
    });

    const data = await response.json();
    console.log('[Custom] Resposta:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.messageId || data.id };
  } catch (error: unknown) {
    console.error('[Custom] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
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
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[send-whatsapp-message] User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-whatsapp-message] User:', user.id);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[send-whatsapp-message] Payload:', { 
      conversation_id: payload.conversation_id,
      content: payload.content?.substring(0, 50) + '...',
      type: payload.type
    });

    if (!payload.conversation_id || !payload.content) {
      return new Response(
        JSON.stringify({ error: 'conversation_id e content são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation with lead info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        lead_id,
        leads (
          id,
          phone,
          name
        )
      `)
      .eq('id', payload.conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[send-whatsapp-message] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // leads is a single object (not array) due to .single() on conversations
    const lead = conversation.leads as unknown as { id: string; phone: string; name: string } | null;
    if (!lead?.phone) {
      return new Response(
        JSON.stringify({ error: 'Lead não possui telefone cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-whatsapp-message] Lead:', lead.name, lead.phone);

    // Get active WhatsApp config
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError) {
      console.error('[send-whatsapp-message] Config error:', configError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configuração do WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum gateway WhatsApp ativo configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configs[0] as WhatsAppConfig;
    console.log('[send-whatsapp-message] Provider:', config.provider, 'Instance:', config.instance_name);

    // Send message based on provider
    const messageType = payload.type || 'text';
    let result: { success: boolean; messageId?: string; error?: string };
    
    switch (config.provider) {
      case 'waha':
        result = await sendWAHA(config, lead.phone, payload.content, messageType, payload.media_url);
        break;
      case 'evolution':
        result = await sendEvolution(config, lead.phone, payload.content, messageType, payload.media_url);
        break;
      case 'z-api':
        result = await sendZAPI(config, lead.phone, payload.content, messageType, payload.media_url);
        break;
      case 'custom':
        result = await sendCustom(config, lead.phone, payload.content, messageType, payload.media_url);
        break;
      default:
        result = { success: false, error: 'Provider desconhecido' };
    }

    if (!result.success) {
      console.error('[send-whatsapp-message] Falha ao enviar:', result.error);
      return new Response(
        JSON.stringify({ error: result.error, provider: config.provider }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save message to database with external_id for status tracking
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: payload.conversation_id,
        lead_id: lead.id,
        content: payload.content,
        type: messageType,
        media_url: payload.media_url,
        sender_type: 'agent',
        sender_id: user.id,
        direction: 'outbound',
        status: 'sent',
        external_id: result.messageId || null, // ID do WhatsApp para rastrear status
      })
      .select()
      .single();

    if (messageError) {
      console.error('[send-whatsapp-message] Erro ao salvar mensagem:', messageError);
      // Mensagem foi enviada, mas não salva - ainda retorna sucesso
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', payload.conversation_id);

    console.log('[send-whatsapp-message] Mensagem enviada com sucesso:', result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        message: savedMessage,
        provider: config.provider,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-whatsapp-message] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
