import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { debug, debugError } from '../_shared/debug.ts';

const PREFIX = 'n8n-ai-response';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ========== TIPOS ==========
interface N8NPayload {
  phone: string;
  message: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  lead_id?: string;
  conversation_id?: string;
  lead_data?: {
    name?: string;
    temperature?: 'cold' | 'warm' | 'hot';
    benefit_type?: string;
    estimated_value?: number;
    cpf?: string;
    notes?: string;
    stage_id?: string;
    custom_fields?: Record<string, unknown>;
  };
}

interface WhatsAppConfig {
  id: string;
  name: string;
  provider: 'waha' | 'meta';
  base_url: string;
  api_key: string;
  instance_name: string | null;
  phone_number: string | null;
  tenant_id: string;
  // Meta Cloud API specific
  phone_number_id?: string;
  business_account_id?: string;
}

// ========== HELPERS ==========
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function safeErrorResponse(
  internalError: unknown,
  publicMessage: string,
  status: number = 500
): Response {
  debugError(PREFIX, 'Internal error:', internalError);
  return new Response(JSON.stringify({ success: false, error: publicMessage }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ========== ENVIO VIA WAHA ==========
async function sendWaha(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  type: string = 'text',
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const number = normalizePhone(phone);
  const session = config.instance_name || 'default';
  const chatId = `${number}@s.whatsapp.net`;

  try {
    let endpoint: string;
    let body: Record<string, unknown>;

    if (type === 'text' || !mediaUrl) {
      endpoint = `${baseUrl}/api/sendText`;
      body = { chatId, text: message, session };
    } else {
      endpoint = `${baseUrl}/api/sendFile`;
      body = { chatId, file: { url: mediaUrl }, caption: message, session };
    }

    debug('WAHA', `Sending ${type} to ${number}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.api_key,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugError('WAHA', 'Error:', response.status, errorText);
      return { success: false, error: `WAHA error: ${response.status}` };
    }

    const result = await response.json();
    const messageId = result?.id || result?.key?.id;

    debug('WAHA', 'Message sent:', messageId);
    return { success: true, messageId };
  } catch (error) {
    debugError('WAHA', 'Exception:', error);
    return { success: false, error: String(error) };
  }
}

// ========== ENVIO VIA META CLOUD API ==========
async function sendMeta(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  type: string = 'text',
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = config.phone_number_id;
  const accessToken = config.api_key;
  const number = normalizePhone(phone);

  if (!phoneNumberId) {
    return { success: false, error: 'Meta Cloud API: phone_number_id not configured' };
  }

  try {
    const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    let body: Record<string, unknown>;

    if (type === 'text' || !mediaUrl) {
      body = {
        messaging_product: 'whatsapp',
        to: number,
        type: 'text',
        text: { body: message },
      };
    } else if (type === 'image') {
      body = {
        messaging_product: 'whatsapp',
        to: number,
        type: 'image',
        image: { link: mediaUrl, caption: message },
      };
    } else if (type === 'audio') {
      body = {
        messaging_product: 'whatsapp',
        to: number,
        type: 'audio',
        audio: { link: mediaUrl },
      };
    } else if (type === 'video') {
      body = {
        messaging_product: 'whatsapp',
        to: number,
        type: 'video',
        video: { link: mediaUrl, caption: message },
      };
    } else if (type === 'document') {
      body = {
        messaging_product: 'whatsapp',
        to: number,
        type: 'document',
        document: { link: mediaUrl, caption: message },
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        to: number,
        type: 'text',
        text: { body: message },
      };
    }

    debug('Meta', `Sending ${type} to ${number}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugError('Meta', 'Error:', response.status, errorText);
      return { success: false, error: `Meta Cloud API error: ${response.status}` };
    }

    const result = await response.json();
    const messageId = result?.messages?.[0]?.id;

    debug('Meta', 'Message sent:', messageId);
    return { success: true, messageId };
  } catch (error) {
    debugError('Meta', 'Exception:', error);
    return { success: false, error: String(error) };
  }
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey =
      req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key required (x-api-key header)' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: apiKeyId, error: keyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (keyError || !apiKeyId) {
      debugError(PREFIX, 'Invalid API key:', keyError?.message);
      return new Response(JSON.stringify({ success: false, error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('created_by')
      .eq('id', apiKeyId)
      .single();

    let tenantId: string | null = null;
    if (apiKeyData?.created_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', apiKeyData.created_by)
        .single();
      tenantId = profile?.tenant_id || null;
    }
    debug(PREFIX, `Authenticated tenant: ${tenantId}`);

    const payload: N8NPayload = await req.json();

    if (!payload.phone) {
      return new Response(JSON.stringify({ success: false, error: 'phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payload.message && payload.type === 'text') {
      return new Response(
        JSON.stringify({ success: false, error: 'message is required for text type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhone(payload.phone);
    debug(PREFIX, `Processing message to: ${normalizedPhone}`);

    let whatsappQuery = supabase.from('whatsapp_config').select('*').eq('is_active', true);

    if (tenantId) {
      whatsappQuery = whatsappQuery.eq('tenant_id', tenantId);
    }

    const { data: whatsappConfig, error: whatsappError } = await whatsappQuery.limit(1).single();

    if (whatsappError || !whatsappConfig) {
      debugError(PREFIX, 'No active WhatsApp instance found');
      return new Response(
        JSON.stringify({ success: false, error: 'No active WhatsApp instance configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneVariations = [
      normalizedPhone,
      normalizedPhone.startsWith('55') ? normalizedPhone.substring(2) : `55${normalizedPhone}`,
      normalizedPhone.slice(-11),
      normalizedPhone.slice(-10),
    ];

    let leadId = payload.lead_id;
    let conversationId = payload.conversation_id;

    if (!leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(phoneVariations.map((p) => `phone.ilike.%${p}`).join(','))
        .limit(1)
        .single();

      if (lead) {
        leadId = lead.id;
        debug(PREFIX, `Found lead: ${leadId}`);
      }
    }

    if (!conversationId && leadId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('lead_id', leadId)
        .in('status', ['open', 'pending'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (conversation) {
        conversationId = conversation.id;
        debug(PREFIX, `Found conversation: ${conversationId}`);
      }
    }

    if (leadId && payload.lead_data) {
      const updateData: Record<string, unknown> = {};

      if (payload.lead_data.name) updateData.name = payload.lead_data.name;
      if (payload.lead_data.temperature) updateData.temperature = payload.lead_data.temperature;
      if (payload.lead_data.benefit_type) updateData.benefit_type = payload.lead_data.benefit_type;
      if (payload.lead_data.estimated_value)
        updateData.estimated_value = payload.lead_data.estimated_value;
      if (payload.lead_data.cpf) updateData.cpf = payload.lead_data.cpf;
      if (payload.lead_data.notes) updateData.notes = payload.lead_data.notes;
      if (payload.lead_data.stage_id) updateData.stage_id = payload.lead_data.stage_id;
      if (payload.lead_data.custom_fields)
        updateData.custom_fields = payload.lead_data.custom_fields;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('leads')
          .update(updateData)
          .eq('id', leadId);

        if (updateError) {
          debugError(PREFIX, 'Error updating lead:', updateError);
        } else {
          debug(PREFIX, 'Lead updated with AI data');
        }
      }
    }

    let sendResult: { success: boolean; messageId?: string; error?: string };
    const config = whatsappConfig as WhatsAppConfig;
    const messageType = payload.type || 'text';

    switch (config.provider) {
      case 'waha':
        sendResult = await sendWaha(
          config,
          normalizedPhone,
          payload.message,
          messageType,
          payload.media_url
        );
        break;
      case 'meta':
        sendResult = await sendMeta(
          config,
          normalizedPhone,
          payload.message,
          messageType,
          payload.media_url
        );
        break;
      default:
        sendResult = {
          success: false,
          error: `Unsupported provider: ${config.provider}. Use 'waha' or 'meta'.`,
        };
    }

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error || 'Failed to send message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageData = {
      tenant_id: tenantId,
      conversation_id: conversationId,
      lead_id: leadId,
      content: payload.message,
      message_type: messageType,
      direction: 'outbound',
      status: 'sent',
      whatsapp_message_id: sendResult.messageId,
      metadata: {
        source: 'n8n-ai',
        provider: config.provider,
        sent_at: new Date().toISOString(),
      },
    };

    const { data: savedMessage, error: saveError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('id')
      .single();

    if (saveError) {
      debugError(PREFIX, 'Error saving message:', saveError);
    }

    if (conversationId) {
      await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    debug(PREFIX, `Success! Message ID: ${sendResult.messageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: savedMessage?.id,
        whatsapp_message_id: sendResult.messageId,
        lead_id: leadId,
        conversation_id: conversationId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return safeErrorResponse(error, 'Internal server error');
  }
});
