import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeErrorResponse(internalError: unknown, publicMessage: string, status: number = 500): Response {
  console.error('Internal error:', internalError);
  return new Response(
    JSON.stringify({ success: false, error: publicMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (apiKeyError || !apiKeyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[api-funnels] API key validated');

    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get('id');
    const tenantId = url.searchParams.get('tenant_id');

    if (method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Only GET method is allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-funnels - List all funnel stages grouped by "grupo"
    if (!id) {
      let query = supabase
        .from('funnel_stages')
        .select('*')
        .order('order', { ascending: true });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: stages, error } = await query;

      if (error) {
        return safeErrorResponse(error, 'Error listing funnel stages');
      }

      // Group stages by "grupo" field - preserve original ID for count lookup
      const groups: Record<string, any[]> = {};
      (stages || []).forEach((stage: any) => {
        const grupo = stage.grupo || 'Principal';
        if (!groups[grupo]) {
          groups[grupo] = [];
        }
        groups[grupo].push({
          original_id: stage.id,
          id: `etapa_${stage.id.slice(0, 8)}`,
          nome: stage.name,
          ordem: stage.order,
          cor: stage.color
        });
      });

      // Get lead counts per stage
      const { data: leadCounts } = await supabase
        .from('leads')
        .select('stage_id')
        .in('stage_id', (stages || []).map((s: any) => s.id));

      const countByStage: Record<string, number> = {};
      (leadCounts || []).forEach((l: any) => {
        countByStage[l.stage_id] = (countByStage[l.stage_id] || 0) + 1;
      });

      // Transform to funnel format
      const funnels = Object.entries(groups).map(([grupo, etapas]) => ({
        id: `funil_${grupo.toLowerCase().replace(/\s+/g, '_').slice(0, 8)}`,
        nome: grupo,
        total_etapas: etapas.length,
        total_oportunidades: etapas.reduce((sum, e) => sum + (countByStage[e.original_id] || 0), 0),
        etapas: etapas.map(e => ({
          id: e.id,
          nome: e.nome,
          ordem: e.ordem,
          cor: e.cor,
          total: countByStage[e.original_id] || 0
        }))
      }));

      console.log('[api-funnels] Listed', funnels.length, 'funnels');

      return new Response(
        JSON.stringify({ dados: funnels }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-funnels?id=xxx&action=campos-personalizados - Get custom fields for funnel
    if (id && url.searchParams.get('action') === 'campos-personalizados') {
      // Get custom field definitions for this tenant/funnel
      const { data: customFields, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return safeErrorResponse(error, 'Error fetching custom fields');
      }

      // Transform to API format
      const campos = (customFields || []).map((cf: any) => ({
        id: `campo_${cf.id.slice(0, 8)}`,
        nome: cf.name,
        tipo: cf.field_type,
        obrigatorio: cf.is_required,
        opcoes: cf.options
      }));

      console.log('[api-funnels] Custom fields for funnel:', campos.length);

      return new Response(
        JSON.stringify(campos),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-funnels?id=xxx - Get specific funnel (by grupo name or stage ID)
    if (id) {
      let query = supabase
        .from('funnel_stages')
        .select('*')
        .order('order', { ascending: true });

      // Try to find by grupo name first
      const { data: stagesByGrupo } = await query.ilike('grupo', id.replace(/_/g, ' '));

      let stages = stagesByGrupo;
      let funnelName = id.replace(/_/g, ' ');

      // If no stages found by grupo, try to get all stages (single funnel mode)
      if (!stages || stages.length === 0) {
        const { data: allStages, error } = await supabase
          .from('funnel_stages')
          .select('*')
          .order('order', { ascending: true });

        if (error) {
          return safeErrorResponse(error, 'Error fetching funnel');
        }

        stages = allStages;
        funnelName = 'Principal';
      }

      if (!stages || stages.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Funnel not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get lead counts per stage
      const { data: leadCounts } = await supabase
        .from('leads')
        .select('stage_id')
        .in('stage_id', stages.map((s: any) => s.id));

      const countByStage: Record<string, number> = {};
      (leadCounts || []).forEach((l: any) => {
        countByStage[l.stage_id] = (countByStage[l.stage_id] || 0) + 1;
      });

      const funnel = {
        id: `funil_${funnelName.toLowerCase().replace(/\s+/g, '_').slice(0, 8)}`,
        nome: funnelName,
        etapas: stages.map((s: any) => ({
          id: `etapa_${s.id.slice(0, 8)}`,
          nome: s.name,
          ordem: s.order,
          cor: s.color,
          total: countByStage[s.id] || 0
        }))
      };

      return new Response(
        JSON.stringify(funnel),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-funnels] Error:', error);
    return safeErrorResponse(error, 'Internal server error');
  }
});
