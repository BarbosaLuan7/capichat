import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppInstanceResponse {
  id: string;
  name: string;
  phone_number: string | null;
  provider: string;
  is_active: boolean;
  tenant_id: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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
      console.error('[api-whatsapp-instances] API key inválida:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'API key inválida ou inativa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    const activeOnly = url.searchParams.get('active_only') !== 'false'; // Default to true

    console.log('[api-whatsapp-instances] Buscando instâncias:', { tenantId, activeOnly });

    // Build query - only return safe fields (no api_key, webhook_secret, etc.)
    let query = supabase
      .from('whatsapp_config')
      .select('id, name, phone_number, provider, is_active, tenant_id')
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
        JSON.stringify({ error: 'Erro ao buscar instâncias WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: WhatsAppInstanceResponse[] = (instances || []).map(inst => ({
      id: inst.id,
      name: inst.name,
      phone_number: inst.phone_number,
      provider: inst.provider,
      is_active: inst.is_active,
      tenant_id: inst.tenant_id,
    }));

    console.log('[api-whatsapp-instances] Retornando', response.length, 'instâncias');

    return new Response(
      JSON.stringify({
        data: response,
        total: response.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[api-whatsapp-instances] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
