import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatbotPayload {
  nome: string;
  descricao?: string;
  nodes?: any[];
  connections?: any[];
  ativo?: boolean;
}

function formatChatbot(bot: any) {
  return {
    id: bot.id,
    nome: bot.name,
    descricao: bot.description,
    nodes: bot.nodes || [],
    connections: bot.connections || [],
    ativo: bot.is_active,
    criado_em: bot.created_at,
    atualizado_em: bot.updated_at
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

    // GET - List or get single
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase
          .from('chatbot_flows')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Chatbot não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(formatChatbot(data)),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao listar chatbots' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ dados: (data || []).map(formatChatbot) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create or trigger
    if (req.method === 'POST') {
      // POST /api-chatbots?action=enviar - Trigger chatbot for contact
      if (action === 'enviar') {
        const body = await req.json();
        
        if (!body.chatbot_id || !body.contato_id) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'chatbot_id e contato_id são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get chatbot
        const { data: chatbot, error: botError } = await supabase
          .from('chatbot_flows')
          .select('*')
          .eq('id', body.chatbot_id)
          .eq('is_active', true)
          .single();

        if (botError || !chatbot) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Chatbot não encontrado ou inativo' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get lead
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', body.contato_id)
          .single();

        if (leadError || !lead) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Contato não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // TODO: Implement actual chatbot execution logic
        // For now, just return success
        console.log(`[api-chatbots] Triggering chatbot ${chatbot.name} for lead ${lead.name}`);

        return new Response(
          JSON.stringify({ 
            sucesso: true, 
            mensagem: 'Fluxo iniciado',
            chatbot: formatChatbot(chatbot),
            contato: { id: lead.id, nome: lead.name }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api-chatbots - Create chatbot
      const body: ChatbotPayload = await req.json();

      if (!body.nome) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'nome é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('chatbot_flows')
        .insert({
          name: body.nome,
          description: body.descricao,
          nodes: body.nodes || [],
          connections: body.connections || [],
          is_active: body.ativo ?? false
        })
        .select()
        .single();

      if (error) {
        console.error('[api-chatbots] Create error:', error);
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao criar chatbot' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, chatbot: formatChatbot(data) }),
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

      const body: Partial<ChatbotPayload> = await req.json();
      const updateData: Record<string, unknown> = {};

      if (body.nome !== undefined) updateData.name = body.nome;
      if (body.descricao !== undefined) updateData.description = body.descricao;
      if (body.nodes !== undefined) updateData.nodes = body.nodes;
      if (body.connections !== undefined) updateData.connections = body.connections;
      if (body.ativo !== undefined) updateData.is_active = body.ativo;

      const { data, error } = await supabase
        .from('chatbot_flows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao atualizar chatbot' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, chatbot: formatChatbot(data) }),
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

      const { error } = await supabase
        .from('chatbot_flows')
        .delete()
        .eq('id', id);

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao remover chatbot' }),
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
    console.error('[api-chatbots] Error:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
