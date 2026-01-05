import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const tipoMap: Record<string, string> = {
  'text': 'texto',
  'image': 'imagem',
  'audio': 'audio',
  'video': 'video',
  'document': 'documento'
};

const statusMap: Record<string, string> = {
  'sent': 'enviada',
  'delivered': 'entregue',
  'read': 'lida'
};

function formatMensagem(msg: any) {
  return {
    id: msg.id,
    conversa_id: msg.conversation_id,
    tipo: tipoMap[msg.type] || msg.type,
    conteudo: msg.content,
    remetente_tipo: msg.sender_type === 'lead' ? 'contato' : 'atendente',
    remetente_id: msg.sender_id,
    direcao: msg.direction === 'inbound' ? 'entrada' : 'saida',
    status: statusMap[msg.status] || msg.status,
    media_url: msg.media_url,
    transcricao: msg.transcription,
    externa_id: msg.external_id,
    enviada_em: msg.created_at
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
    const conversaId = url.searchParams.get('conversa_id');
    const page = parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('por_pagina') || url.searchParams.get('page_size') || '50');

    // GET - Get message(s)
    if (req.method === 'GET') {
      // GET /api-mensagens?id=xxx&action=status
      if (id && action === 'status') {
        const { data, error } = await supabase
          .from('messages')
          .select('id, status, created_at')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Mensagem não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            id: data.id,
            status: statusMap[data.status] || data.status,
            atualizado_em: data.created_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api-mensagens?id=xxx
      if (id) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Mensagem não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(formatMensagem(data)),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api-mensagens?conversa_id=xxx - List messages in conversation
      if (conversaId) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
          .from('messages')
          .select('*', { count: 'exact' })
          .eq('conversation_id', conversaId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Erro ao listar mensagens' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            dados: (data || []).map(formatMensagem),
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

      return new Response(
        JSON.stringify({ sucesso: false, erro: 'id ou conversa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Soft delete message
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as deleted locally (soft delete)
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted_locally: true })
        .eq('id', id);

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao remover mensagem' }),
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
    console.error('[api-mensagens] Error:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
