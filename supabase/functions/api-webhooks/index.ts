import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Available webhook events
const WEBHOOK_EVENTS = [
  { evento: 'lead.created', descricao: 'Novo contato criado' },
  { evento: 'lead.updated', descricao: 'Contato atualizado' },
  { evento: 'lead.deleted', descricao: 'Contato removido' },
  { evento: 'lead.stage_changed', descricao: 'Contato movido de etapa' },
  { evento: 'lead.assigned', descricao: 'Contato atribuído a atendente' },
  { evento: 'lead.temperature_changed', descricao: 'Temperatura do contato alterada' },
  { evento: 'lead.label_added', descricao: 'Etiqueta adicionada ao contato' },
  { evento: 'lead.label_removed', descricao: 'Etiqueta removida do contato' },
  { evento: 'lead.summary_updated', descricao: 'Resumo do caso atualizado' },
  { evento: 'message.received', descricao: 'Nova mensagem recebida do contato' },
  { evento: 'message.sent', descricao: 'Mensagem enviada para o contato' },
  { evento: 'conversation.created', descricao: 'Nova conversa iniciada' },
  { evento: 'conversation.assigned', descricao: 'Conversa atribuída a atendente' },
  { evento: 'conversation.resolved', descricao: 'Conversa finalizada' },
  { evento: 'task.created', descricao: 'Nova tarefa criada' },
  { evento: 'task.completed', descricao: 'Tarefa concluída' },
];

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

    console.log('[api-webhooks] API key validated');

    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    // GET /api-webhooks?action=eventos - List available events
    if (method === 'GET' && action === 'eventos') {
      return new Response(
        JSON.stringify(WEBHOOK_EVENTS),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-webhooks - List webhooks
    if (method === 'GET' && !id && !action) {
      const { data: webhooks, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return safeErrorResponse(error, 'Error listing webhooks');
      }

      const transformed = (webhooks || []).map((w: any) => ({
        id: w.id,
        nome: w.name,
        url: w.url,
        eventos: w.events,
        ativo: w.is_active,
        criado_em: w.created_at
      }));

      console.log('[api-webhooks] Listed', transformed.length, 'webhooks');

      return new Response(
        JSON.stringify({ dados: transformed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-webhooks?id=xxx - Get single webhook
    if (method === 'GET' && id) {
      const { data: webhook, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return safeErrorResponse(error, 'Error fetching webhook');
      }

      if (!webhook) {
        return new Response(
          JSON.stringify({ success: false, error: 'Webhook not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          id: webhook.id,
          nome: webhook.name,
          url: webhook.url,
          eventos: webhook.events,
          ativo: webhook.is_active,
          headers: webhook.headers,
          criado_em: webhook.created_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-webhooks - Create webhook
    if (method === 'POST' && !id) {
      const body = await req.json();

      if (!body.name || !body.url || !body.events) {
        return new Response(
          JSON.stringify({ success: false, error: 'name, url, and events are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate URL
      try {
        new URL(body.url);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate events
      const validEvents = WEBHOOK_EVENTS.map(e => e.evento);
      const invalidEvents = body.events.filter((e: string) => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid events: ${invalidEvents.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: newWebhook, error } = await supabase
        .from('webhooks')
        .insert({
          name: body.name,
          url: body.url,
          events: body.events,
          secret: body.secret || crypto.randomUUID(),
          headers: body.headers || {},
          is_active: true
        })
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error creating webhook');
      }

      console.log('[api-webhooks] Webhook created:', newWebhook.id);

      return new Response(
        JSON.stringify({
          id: newWebhook.id,
          nome: newWebhook.name,
          url: newWebhook.url,
          eventos: newWebhook.events,
          ativo: newWebhook.is_active,
          segredo: newWebhook.secret,
          criado_em: newWebhook.created_at
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-webhooks?id=xxx - Update webhook
    if (method === 'PUT' && id) {
      const body = await req.json();

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.url !== undefined) {
        try {
          new URL(body.url);
          updateData.url = body.url;
        } catch {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid URL format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      if (body.events !== undefined) updateData.events = body.events;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.headers !== undefined) updateData.headers = body.headers;
      if (body.secret !== undefined) updateData.secret = body.secret;

      const { data: updatedWebhook, error } = await supabase
        .from('webhooks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error updating webhook');
      }

      console.log('[api-webhooks] Webhook updated:', id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          webhook: {
            id: updatedWebhook.id,
            nome: updatedWebhook.name,
            url: updatedWebhook.url,
            eventos: updatedWebhook.events,
            ativo: updatedWebhook.is_active
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-webhooks?id=xxx - Delete webhook
    if (method === 'DELETE' && id) {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', id);

      if (error) {
        return safeErrorResponse(error, 'Error deleting webhook');
      }

      console.log('[api-webhooks] Webhook deleted:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Webhook removido com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed or invalid action' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-webhooks] Error:', error);
    return safeErrorResponse(error, 'Internal server error');
  }
});
