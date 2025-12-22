import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessagePayload {
  phone: string;
  message: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  lead_id?: string;
  conversation_id?: string;
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

      // Se deu certo ou não é erro de auth, retorna
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

  // Se chegou aqui, nenhum formato funcionou
  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('Todos os formatos de autenticação falharam');
}

// Provider-specific message sending functions
async function sendWAHA(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const chatId = payload.phone.replace(/\D/g, '') + '@c.us';
  const session = config.instance_name || 'default';
  
  let endpoint = '/api/sendText';
  let body: Record<string, unknown> = {
    chatId,
    text: payload.message,
    session,
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = '/api/sendImage';
    body = {
      chatId,
      file: { url: payload.media_url },
      caption: payload.message,
      session,
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: payload.media_url },
      session,
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: payload.media_url },
      caption: payload.message,
      session,
    };
  }

  const url = `${baseUrl}${endpoint}`;
  console.log('[WAHA] Enviando mensagem:', { url, chatId, session, type: payload.type });

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

async function sendEvolution(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const number = payload.phone.replace(/\D/g, '');
  const instance = config.instance_name || 'default';
  
  let endpoint = `/message/sendText/${instance}`;
  let body: Record<string, unknown> = {
    number,
    text: payload.message,
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'image',
      media: payload.media_url,
      caption: payload.message,
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = `/message/sendWhatsAppAudio/${instance}`;
    body = {
      number,
      audio: payload.media_url,
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'document',
      media: payload.media_url,
      caption: payload.message,
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

async function sendZAPI(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const phone = payload.phone.replace(/\D/g, '');
  
  let endpoint = '/send-text';
  let body: Record<string, unknown> = {
    phone,
    message: payload.message,
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = '/send-image';
    body = {
      phone,
      image: payload.media_url,
      caption: payload.message,
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = '/send-audio';
    body = {
      phone,
      audio: payload.media_url,
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = '/send-document';
    body = {
      phone,
      document: payload.media_url,
    };
  }

  try {
    console.log('[Z-API] Enviando mensagem:', { baseUrl, endpoint, phone });
    
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

async function sendCustom(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
        phone: payload.phone,
        message: payload.message,
        type: payload.type || 'text',
        media_url: payload.media_url,
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (apiKeyError || !apiKeyId) {
      console.error('[api-messages-send] API key inválida:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'API key inválida ou inativa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[api-messages-send] Payload:', { ...payload, message: payload.message?.substring(0, 50) + '...' });

    if (!payload.phone || !payload.message) {
      return new Response(
        JSON.stringify({ error: 'phone e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active WhatsApp config
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError) {
      console.error('[api-messages-send] Erro ao buscar config:', configError);
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
    console.log('[api-messages-send] Provider:', config.provider, 'Instance:', config.instance_name);

    // Send message based on provider
    let result: { success: boolean; messageId?: string; error?: string };
    
    switch (config.provider) {
      case 'waha':
        result = await sendWAHA(config, payload);
        break;
      case 'evolution':
        result = await sendEvolution(config, payload);
        break;
      case 'z-api':
        result = await sendZAPI(config, payload);
        break;
      case 'custom':
        result = await sendCustom(config, payload);
        break;
      default:
        result = { success: false, error: 'Provider desconhecido' };
    }

    if (!result.success) {
      console.error('[api-messages-send] Falha ao enviar:', result.error);
      return new Response(
        JSON.stringify({ error: result.error, provider: config.provider }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create conversation if lead_id provided
    let conversationId = payload.conversation_id;
    let leadId = payload.lead_id;

    if (!conversationId && payload.phone) {
      // Try to find lead by phone
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', payload.phone)
        .single();

      if (lead) {
        leadId = lead.id;
        
        // Find existing conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('lead_id', lead.id)
          .in('status', ['open', 'pending'])
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();

        if (conversation) {
          conversationId = conversation.id;
        }
      }
    }

    // Save message to database if we have a conversation
    if (conversationId) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          lead_id: leadId,
          content: payload.message,
          type: payload.type || 'text',
          media_url: payload.media_url,
          sender_type: 'agent',
          sender_id: apiKeyId,
          direction: 'outbound',
          status: 'sent',
        });

      if (messageError) {
        console.error('[api-messages-send] Erro ao salvar mensagem:', messageError);
      }

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    console.log('[api-messages-send] Mensagem enviada:', result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        provider: config.provider,
        conversation_id: conversationId,
        lead_id: leadId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[api-messages-send] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
