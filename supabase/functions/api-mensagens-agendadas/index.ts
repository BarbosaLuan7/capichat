import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgendamentoPayload {
  contato_id: string;
  conversa_id?: string;
  conteudo: string;
  agendar_para: string; // ISO datetime
  template_id?: string;
}

function formatAgendamento(msg: any) {
  return {
    id: msg.id,
    contato_id: msg.lead_id,
    conversa_id: msg.conversation_id,
    conteudo: msg.content,
    agendado_para: msg.scheduled_for,
    status: msg.status,
    enviado_em: msg.sent_at,
    erro: msg.error_message,
    criado_em: msg.created_at,
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
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (apiKeyError || !apiKeyId) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'API key inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1');
    const pageSize = parseInt(
      url.searchParams.get('por_pagina') || url.searchParams.get('page_size') || '50'
    );

    // GET - List or get single
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase
          .from('scheduled_messages')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Agendamento não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify(formatAgendamento(data)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List with filters
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact' })
        .order('scheduled_for', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao listar agendamentos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          dados: (data || []).map(formatAgendamento),
          paginacao: {
            pagina: page,
            por_pagina: pageSize,
            total: count || 0,
            total_paginas: Math.ceil((count || 0) / pageSize),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create or cancel
    if (req.method === 'POST') {
      // POST /api-mensagens-agendadas?id=xxx&action=cancelar
      if (id && action === 'cancelar') {
        const { data, error } = await supabase
          .from('scheduled_messages')
          .update({ status: 'cancelled' })
          .eq('id', id)
          .eq('status', 'pending')
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Agendamento não encontrado ou já processado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sucesso: true, agendamento: formatAgendamento(data) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api-mensagens-agendadas - Create
      const body: AgendamentoPayload = await req.json();

      if (!body.contato_id || !body.conteudo || !body.agendar_para) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro: 'contato_id, conteudo e agendar_para são obrigatórios',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate future date
      const scheduledDate = new Date(body.agendar_para);
      if (scheduledDate <= new Date()) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'A data de agendamento deve ser no futuro' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert({
          lead_id: body.contato_id,
          conversation_id: body.conversa_id,
          content: body.conteudo,
          scheduled_for: body.agendar_para,
          template_id: body.template_id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('[api-mensagens-agendadas] Create error:', error);
        return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao criar agendamento' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ sucesso: true, agendamento: formatAgendamento(data) }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT - Update
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body: Partial<AgendamentoPayload> = await req.json();
      const updateData: Record<string, unknown> = {};

      if (body.conteudo !== undefined) updateData.content = body.conteudo;
      if (body.agendar_para !== undefined) {
        const scheduledDate = new Date(body.agendar_para);
        if (scheduledDate <= new Date()) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'A data de agendamento deve ser no futuro' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        updateData.scheduled_for = body.agendar_para;
      }

      const { data, error } = await supabase
        .from('scheduled_messages')
        .update(updateData)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Agendamento não encontrado ou já processado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ sucesso: true, agendamento: formatAgendamento(data) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Delete pending
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id)
        .eq('status', 'pending');

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao remover agendamento' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ sucesso: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sucesso: false, erro: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api-mensagens-agendadas] Error:', error);
    return new Response(JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
