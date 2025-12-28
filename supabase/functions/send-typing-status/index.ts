import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeToWahaChatId(phone: string): { chatId: string | null; reason?: string; normalized?: string } {
  const digits = phone.replace(/\D/g, '');

  // Likely Facebook LID or invalid phone (too long). We skip to avoid WAHA 500.
  if (digits.length > 13) {
    return { chatId: null, reason: 'phone_too_long', normalized: digits };
  }

  let normalized = digits;
  // Default behavior for Brazil: add country code 55 when absent
  if (!normalized.startsWith('55') && (normalized.length === 10 || normalized.length === 11)) {
    normalized = `55${normalized}`;
  }

  if (normalized.length < 12 || normalized.length > 13) {
    return { chatId: null, reason: 'phone_invalid_length', normalized };
  }

  return { chatId: `${normalized}@c.us`, normalized };
}

interface TypingStatusRequest {
  conversationId: string;
  status: 'typing' | 'paused';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, status }: TypingStatusRequest = await req.json();

    if (!conversationId || !status) {
      return new Response(
        JSON.stringify({ error: 'conversationId and status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-typing-status] Sending ${status} for conversation ${conversationId}`);

    // Get conversation with lead phone and whatsapp config
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        lead_id,
        whatsapp_instance_id,
        leads:lead_id (phone, is_facebook_lid, original_lid)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[send-typing-status] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = conversation.leads as any;
    const leadPhone = lead?.phone as string | undefined;
    const isFacebookLid = Boolean(lead?.is_facebook_lid);

    if (!leadPhone) {
      console.error('[send-typing-status] Lead phone not found');
      return new Response(
        JSON.stringify({ error: 'Lead phone not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isFacebookLid) {
      console.log('[send-typing-status] Skipping presence for Facebook LID lead');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'facebook_lid' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp config
    let configQuery = supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true);

    if (conversation.whatsapp_instance_id) {
      configQuery = configQuery.eq('id', conversation.whatsapp_instance_id);
    }

    const { data: whatsappConfig, error: configError } = await configQuery.limit(1).single();

    if (configError || !whatsappConfig) {
      console.error('[send-typing-status] WhatsApp config not found:', configError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp config not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone for chatId (WAHA expects format like 5511999999999@c.us)
    const { chatId, reason, normalized } = normalizeToWahaChatId(leadPhone);
    if (!chatId) {
      console.log('[send-typing-status] Skipping presence due to invalid phone:', { reason, leadPhone, normalized });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason, normalized }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build WAHA presence API URL
    const baseUrl = whatsappConfig.base_url.replace(/\/$/, '');
    const session = whatsappConfig.instance_name || 'default';
    const presenceUrl = `${baseUrl}/api/${session}/presence`;

    console.log(`[send-typing-status] Calling WAHA: ${presenceUrl} with chatId: ${chatId}, presence: ${status}`);

    // Send presence to WAHA
    const wahaResponse = await fetch(presenceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': whatsappConfig.api_key,
      },
      body: JSON.stringify({
        chatId,
        presence: status,
      }),
    });

    if (!wahaResponse.ok) {
      const errorText = await wahaResponse.text();
      console.error('[send-typing-status] WAHA error:', wahaResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send presence to WAHA', details: errorText }),
        { status: wahaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await wahaResponse.json();
    console.log('[send-typing-status] WAHA response:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-typing-status] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
