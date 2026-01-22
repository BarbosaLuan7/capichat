import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar últimos logs de webhook
    const { data: logs, error: logsError } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar últimas mensagens recebidas
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, direction, created_at, waha_message_id')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(5);

    // Buscar webhooks configurados
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('id, name, url, events, is_active')
      .limit(10);

    return new Response(
      JSON.stringify(
        {
          success: true,
          webhook_logs: logs || [],
          webhook_logs_error: logsError?.message || null,
          recent_messages: messages || [],
          messages_error: messagesError?.message || null,
          webhooks: webhooks || [],
          webhooks_error: webhooksError?.message || null,
        },
        null,
        2
      ),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
