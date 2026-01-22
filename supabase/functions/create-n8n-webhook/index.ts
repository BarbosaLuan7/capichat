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

    // Pegar URL do body ou usar padrão
    let n8nUrl = 'https://YOUR_N8N_URL/webhook/DEV-SDR';

    try {
      const body = await req.json();
      if (body.url) {
        n8nUrl = body.url;
      }
    } catch {
      // Sem body, usar padrão
    }

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('webhooks')
      .select('id')
      .eq('name', 'N8N Marina SDR')
      .single();

    if (existing) {
      // Atualizar
      const { data, error } = await supabase
        .from('webhooks')
        .update({
          url: n8nUrl,
          events: ['message.received'],
          is_active: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          action: 'updated',
          webhook: data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar novo
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        name: 'N8N Marina SDR',
        url: n8nUrl,
        events: ['message.received'],
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        action: 'created',
        webhook: data,
        message: `Webhook criado! Mensagens recebidas serão enviadas para: ${n8nUrl}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
