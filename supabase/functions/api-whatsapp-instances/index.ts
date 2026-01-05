import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to format phone numbers
function formatTelefone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length >= 10) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ erro: 'Método não permitido' }),
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
        JSON.stringify({ erro: 'Header de autorização ausente ou inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (apiKeyError || !apiKeyId) {
      console.error('[api-whatsapp-instances] API key inválida:', apiKeyError);
      return new Response(
        JSON.stringify({ erro: 'API key inválida ou inativa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    const activeOnly = url.searchParams.get('active_only') !== 'false';
    const id = url.searchParams.get('id');

    console.log('[api-whatsapp-instances] Buscando instâncias:', { tenantId, activeOnly, id });

    // Get single instance by ID
    if (id) {
      const { data: instance, error } = await supabase
        .from('whatsapp_config')
        .select('id, name, phone_number, provider, is_active, tenant_id, instance_name')
        .eq('id', id)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ erro: 'Canal não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          id: instance.id,
          nome: instance.name,
          telefone: formatTelefone(instance.phone_number),
          provedor: instance.provider,
          ativo: instance.is_active,
          identificador: instance.instance_name,
          tenant_id: instance.tenant_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query - only return safe fields (no api_key, webhook_secret, etc.)
    let query = supabase
      .from('whatsapp_config')
      .select('id, name, phone_number, provider, is_active, tenant_id, instance_name')
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: instances, error: queryError } = await query;

    if (queryError) {
      console.error('[api-whatsapp-instances] Erro ao buscar instâncias:', queryError);
      return new Response(
        JSON.stringify({ erro: 'Erro ao buscar canais WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dados = (instances || []).map(inst => ({
      id: inst.id,
      nome: inst.name,
      telefone: formatTelefone(inst.phone_number),
      provedor: inst.provider,
      ativo: inst.is_active,
      identificador: inst.instance_name,
      tenant_id: inst.tenant_id,
    }));

    console.log('[api-whatsapp-instances] Retornando', dados.length, 'instâncias');

    return new Response(
      JSON.stringify({
        dados,
        total: dados.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[api-whatsapp-instances] Erro:', error);
    return new Response(
      JSON.stringify({ erro: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
