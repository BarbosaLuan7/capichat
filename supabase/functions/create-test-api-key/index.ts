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

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_prefix', 'sk_test_')
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'API key já existe',
          api_key: 'sk_test_capichat_n8n_2026',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar um usuário (profile ou auth.users)
    let userId: string | null = null;

    const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();

    if (profile) {
      userId = profile.id;
    } else {
      // Verificar auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      if (authUsers?.users && authUsers.users.length > 0) {
        userId = authUsers.users[0].id;
      }
    }

    // Criar API key
    const apiKey = 'sk_test_capichat_n8n_2026';
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
    const hashHex = Array.from(new Uint8Array(keyHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        name: 'API Key Teste N8N',
        key_hash: hashHex,
        key_prefix: 'sk_test_',
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        api_key: apiKey,
        message: 'API key criada com sucesso',
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
