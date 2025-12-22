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

// Provider-specific message sending functions
async function sendWAHA(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const chatId = payload.phone.replace(/\D/g, '') + '@c.us';
  
  let endpoint = '/api/sendText';
  let body: Record<string, unknown> = {
    chatId,
    text: payload.message,
    session: config.instance_name || 'default',
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = '/api/sendImage';
    body = {
      chatId,
      file: { url: payload.media_url },
      caption: payload.message,
      session: config.instance_name || 'default',
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: payload.media_url },
      session: config.instance_name || 'default',
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: payload.media_url },
      caption: payload.message,
      session: config.instance_name || 'default',
    };
  }

  try {
    const response = await fetch(`${config.base_url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[WAHA] Error response:', data);
      return { success: false, error: data.message || 'Erro ao enviar mensagem via WAHA' };
    }

    return { success: true, messageId: data.id || data.key?.id };
  } catch (error: unknown) {
    console.error('[WAHA] Request error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendEvolution(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
    const response = await fetch(`${config.base_url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Evolution] Error response:', data);
      return { success: false, error: data.message || 'Erro ao enviar mensagem via Evolution API' };
    }

    return { success: true, messageId: data.key?.id };
  } catch (error: unknown) {
    console.error('[Evolution] Request error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendZAPI(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
    const response = await fetch(`${config.base_url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Z-API] Error response:', data);
      return { success: false, error: data.message || 'Erro ao enviar mensagem via Z-API' };
    }

    return { success: true, messageId: data.messageId };
  } catch (error: unknown) {
    console.error('[Z-API] Request error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendCustom(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(config.base_url, {
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
    
    if (!response.ok) {
      console.error('[Custom] Error response:', data);
      return { success: false, error: data.message || 'Erro ao enviar mensagem via gateway customizado' };
    }

    return { success: true, messageId: data.messageId || data.id };
  } catch (error: unknown) {
    console.error('[Custom] Request error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
      console.error('[api-messages-send] Invalid API key:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[api-messages-send] Received payload:', { ...payload, message: payload.message?.substring(0, 50) + '...' });

    if (!payload.phone || !payload.message) {
      return new Response(
        JSON.stringify({ error: 'phone and message are required' }),
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
      console.error('[api-messages-send] Error fetching config:', configError);
      return new Response(
        JSON.stringify({ error: 'Error fetching WhatsApp configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active WhatsApp gateway configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configs[0] as WhatsAppConfig;
    console.log('[api-messages-send] Using provider:', config.provider);

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
        result = { success: false, error: 'Unknown provider' };
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          sender_id: apiKeyId, // Use API key ID as sender
          direction: 'outbound',
          status: 'sent',
        });

      if (messageError) {
        console.error('[api-messages-send] Error saving message:', messageError);
      }

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    console.log('[api-messages-send] Message sent successfully:', result.messageId);

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
    console.error('[api-messages-send] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
