import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const temperatureMap: Record<string, string> = {
  'cold': 'frio',
  'warm': 'morno',
  'hot': 'quente'
};

const temperatureMapReverse: Record<string, string> = {
  'frio': 'cold',
  'morno': 'warm',
  'quente': 'hot'
};

function formatOportunidade(lead: any) {
  return {
    id: lead.id,
    nome: lead.name,
    telefone: lead.phone,
    email: lead.email,
    etapa_id: lead.stage_id,
    etapa: lead.funnel_stages ? {
      id: lead.funnel_stages.id,
      nome: lead.funnel_stages.name,
      cor: lead.funnel_stages.color
    } : null,
    temperatura: temperatureMap[lead.temperature] || lead.temperature,
    responsavel_id: lead.assigned_to,
    valor_estimado: lead.estimated_value,
    tipo_beneficio: lead.benefit_type,
    status_caso: lead.case_status,
    etiquetas: (lead.lead_labels || []).map((ll: any) => ({
      id: ll.labels?.id,
      nome: ll.labels?.name,
      cor: ll.labels?.color
    })),
    criado_em: lead.created_at,
    atualizado_em: lead.updated_at
  };
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
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Header Authorization ausente ou inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (apiKeyError || !apiKeyId) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'API key inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const etapaId = url.searchParams.get('etapa_id');
    const responsavelId = url.searchParams.get('responsavel_id');
    const page = parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('por_pagina') || url.searchParams.get('page_size') || '50');

    // GET - List or get single
    if (req.method === 'GET') {
      // GET /api-oportunidades?id=xxx&action=notas
      if (id && action === 'notas') {
        const { data: activities, error } = await supabase
          .from('lead_activities')
          .select('*')
          .eq('lead_id', id)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Erro ao listar notas' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const notas = (activities || []).map(a => ({
          id: a.id,
          acao: a.action,
          detalhes: a.details,
          criada_em: a.created_at
        }));

        return new Response(
          JSON.stringify({ dados: notas }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api-oportunidades?id=xxx
      if (id) {
        const { data, error } = await supabase
          .from('leads')
          .select('*, funnel_stages(*), lead_labels(*, labels(*))')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Oportunidade não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(formatOportunidade(data)),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api-oportunidades - List with filters
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('leads')
        .select('*, funnel_stages(*), lead_labels(*, labels(*))', { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (etapaId) query = query.eq('stage_id', etapaId);
      if (responsavelId) query = query.eq('assigned_to', responsavelId);

      const { data, error, count } = await query.range(from, to);

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao listar oportunidades' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          dados: (data || []).map(formatOportunidade),
          paginacao: {
            pagina: page,
            por_pagina: pageSize,
            total: count || 0,
            total_paginas: Math.ceil((count || 0) / pageSize)
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create or actions
    if (req.method === 'POST') {
      // POST /api-oportunidades?id=xxx&action=duplicar
      if (id && action === 'duplicar') {
        const { data: original, error: fetchError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !original) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Oportunidade não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { id: _, created_at, updated_at, ...leadData } = original;
        const { data: newLead, error: createError } = await supabase
          .from('leads')
          .insert({
            ...leadData,
            name: `${original.name} (cópia)`
          })
          .select()
          .single();

        if (createError) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Erro ao duplicar oportunidade' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sucesso: true, oportunidade: formatOportunidade(newLead) }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api-oportunidades?id=xxx&action=notas
      if (id && action === 'notas') {
        const body = await req.json();
        
        if (!body.conteudo) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'conteudo é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('lead_activities')
          .insert({
            lead_id: id,
            action: 'note',
            details: { content: body.conteudo }
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Erro ao adicionar nota' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            sucesso: true, 
            nota: { id: data.id, acao: data.action, detalhes: data.details, criada_em: data.created_at }
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api-oportunidades - Create
      const body = await req.json();

      if (!body.nome || !body.telefone) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'nome e telefone são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get first stage if not provided
      let stageId = body.etapa_id;
      if (!stageId) {
        const { data: firstStage } = await supabase
          .from('funnel_stages')
          .select('id')
          .order('order', { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = firstStage?.id;
      }

      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: body.nome,
          phone: body.telefone.replace(/\D/g, ''),
          email: body.email,
          stage_id: stageId,
          assigned_to: body.responsavel_id,
          temperature: temperatureMapReverse[body.temperatura] || 'cold',
          estimated_value: body.valor_estimado,
          benefit_type: body.tipo_beneficio,
          source: body.origem || 'api',
          status: 'active'
        })
        .select('*, funnel_stages(*)')
        .single();

      if (error) {
        console.error('[api-oportunidades] Create error:', error);
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao criar oportunidade' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, oportunidade: formatOportunidade(data) }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update or move
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();

      // PUT /api-oportunidades?id=xxx&action=mover
      if (action === 'mover') {
        if (!body.etapa_id) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'etapa_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('leads')
          .update({ stage_id: body.etapa_id })
          .eq('id', id)
          .select('*, funnel_stages(*)')
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Erro ao mover oportunidade' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sucesso: true, oportunidade: formatOportunidade(data) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-oportunidades?id=xxx - General update
      const updateData: Record<string, unknown> = {};

      if (body.nome !== undefined) updateData.name = body.nome;
      if (body.telefone !== undefined) updateData.phone = body.telefone.replace(/\D/g, '');
      if (body.email !== undefined) updateData.email = body.email;
      if (body.etapa_id !== undefined) updateData.stage_id = body.etapa_id;
      if (body.responsavel_id !== undefined) updateData.assigned_to = body.responsavel_id;
      if (body.temperatura !== undefined) updateData.temperature = temperatureMapReverse[body.temperatura] || body.temperatura;
      if (body.valor_estimado !== undefined) updateData.estimated_value = body.valor_estimado;
      if (body.tipo_beneficio !== undefined) updateData.benefit_type = body.tipo_beneficio;
      if (body.status_caso !== undefined) updateData.case_status = body.status_caso;

      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .select('*, funnel_stages(*), lead_labels(*, labels(*))')
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao atualizar oportunidade' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, oportunidade: formatOportunidade(data) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Soft delete - mark as archived
      const { error } = await supabase
        .from('leads')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao remover oportunidade' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-oportunidades] Error:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
