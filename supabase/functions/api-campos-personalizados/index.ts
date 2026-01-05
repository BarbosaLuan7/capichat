import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampoPayload {
  nome: string;
  rotulo: string;
  tipo?: 'texto' | 'numero' | 'data' | 'selecao' | 'selecao_multipla' | 'booleano';
  opcoes?: string[];
  obrigatorio?: boolean;
  ordem?: number;
  tenant_id?: string;
}

const tipoMap: Record<string, string> = {
  'texto': 'text',
  'numero': 'number',
  'data': 'date',
  'selecao': 'select',
  'selecao_multipla': 'multiselect',
  'booleano': 'boolean'
};

const tipoMapReverse: Record<string, string> = {
  'text': 'texto',
  'number': 'numero',
  'date': 'data',
  'select': 'selecao',
  'multiselect': 'selecao_multipla',
  'boolean': 'booleano'
};

function formatCampo(campo: any) {
  return {
    id: campo.id,
    nome: campo.name,
    rotulo: campo.label,
    tipo: tipoMapReverse[campo.field_type] || campo.field_type,
    opcoes: campo.options || [],
    obrigatorio: campo.is_required,
    ordem: campo.display_order,
    ativo: campo.is_active,
    criado_em: campo.created_at,
    atualizado_em: campo.updated_at
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
    const tenantId = url.searchParams.get('tenant_id');

    // GET - List or get single
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase
          .from('custom_field_definitions')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Campo não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(formatCampo(data)),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let query = supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao listar campos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ dados: (data || []).map(formatCampo) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create
    if (req.method === 'POST') {
      const body: CampoPayload = await req.json();

      if (!body.nome || !body.rotulo) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'nome e rotulo são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert({
          name: body.nome,
          label: body.rotulo,
          field_type: tipoMap[body.tipo || ''] || 'text',
          options: body.opcoes || [],
          is_required: body.obrigatorio || false,
          display_order: body.ordem || 0,
          tenant_id: body.tenant_id || tenantId
        })
        .select()
        .single();

      if (error) {
        console.error('[api-campos-personalizados] Create error:', error);
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao criar campo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, campo: formatCampo(data) }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body: Partial<CampoPayload> = await req.json();
      const updateData: Record<string, unknown> = {};

      if (body.nome !== undefined) updateData.name = body.nome;
      if (body.rotulo !== undefined) updateData.label = body.rotulo;
      if (body.tipo !== undefined) updateData.field_type = tipoMap[body.tipo] || body.tipo;
      if (body.opcoes !== undefined) updateData.options = body.opcoes;
      if (body.obrigatorio !== undefined) updateData.is_required = body.obrigatorio;
      if (body.ordem !== undefined) updateData.display_order = body.ordem;

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao atualizar campo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, campo: formatCampo(data) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Soft delete
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('custom_field_definitions')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao remover campo' }),
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
    console.error('[api-campos-personalizados] Error:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
