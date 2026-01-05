import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: keyId, error: keyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (keyError || !keyId) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const status = url.searchParams.get('status');
    const assignedTo = url.searchParams.get('assigned_to');
    const leadId = url.searchParams.get('lead_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '50');

    // GET - List conversations or get single
    if (req.method === 'GET') {
      if (id) {
        // Get single conversation with messages
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select(`
            *,
            lead:leads(id, name, phone, avatar_url)
          `)
          .eq('id', id)
          .single();

        if (convError) {
          return new Response(
            JSON.stringify({ error: convError.message }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get messages
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true });

        return new Response(
          JSON.stringify({ ...conversation, messages: messages || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List conversations with filters
      let query = supabase
        .from('conversations')
        .select(`
          *,
          lead:leads(id, name, phone, avatar_url)
        `, { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (leadId) query = query.eq('lead_id', leadId);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('last_message_at', { ascending: false })
        .range(from, to);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          data,
          pagination: {
            page,
            page_size: pageSize,
            total: count,
            total_pages: Math.ceil((count || 0) / pageSize)
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create conversation
    if (req.method === 'POST') {
      const body = await req.json();

      if (!body.lead_id) {
        return new Response(
          JSON.stringify({ error: 'lead_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          lead_id: body.lead_id,
          assigned_to: body.assigned_to || null,
          status: body.status || 'open'
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update conversation
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id query parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const action = url.searchParams.get('action');
      const body = await req.json().catch(() => ({}));

      // PUT /api-conversations?id=xxx&action=transferir
      if (action === 'transferir') {
        const updateData: Record<string, unknown> = {};
        
        if (body.tipo === 'usuario' && body.usuario_id) {
          updateData.assigned_to = body.usuario_id;
        } else if (body.tipo === 'equipe' && body.equipe_id) {
          // For team transfer, we can optionally assign to first available member
          updateData.assigned_to = null; // Unassign for team distribution
        }

        const { data, error } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            sucesso: true,
            conversa: { id: data.id, status: data.status },
            transferido_para: body.tipo === 'usuario' 
              ? { tipo: 'usuario', id: body.usuario_id }
              : { tipo: 'equipe', id: body.equipe_id },
            transferido_em: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-conversations?id=xxx&action=atribuir
      if (action === 'atribuir') {
        const { data, error } = await supabase
          .from('conversations')
          .update({ assigned_to: body.usuario_id })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sucesso: true, conversa: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-conversations?id=xxx&action=finalizar
      if (action === 'finalizar') {
        const { data, error } = await supabase
          .from('conversations')
          .update({ status: 'resolved' })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sucesso: true, conversa: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-conversations?id=xxx&action=reabrir
      if (action === 'reabrir') {
        const updateData: Record<string, unknown> = { status: 'open' };
        if (body.responsavel_id) {
          updateData.assigned_to = body.responsavel_id;
        }

        const { data, error } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sucesso: true, conversa: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Default PUT - update conversation fields
      const updateData: Record<string, unknown> = {};

      if (body.status !== undefined) updateData.status = body.status;
      if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to;
      if (body.is_favorite !== undefined) updateData.is_favorite = body.is_favorite;

      const { data, error } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET/POST for notes: /api-conversations?id=xxx&action=notas
    if (id && url.searchParams.get('action') === 'notas') {
      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('internal_notes')
          .select(`
            *,
            author:profiles!internal_notes_author_id_fkey(id, name)
          `)
          .eq('conversation_id', id)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const notes = (data || []).map((n: any) => ({
          id: n.id,
          conteudo: n.content,
          autor: n.author ? { id: n.author.id, nome: n.author.name } : null,
          criada_em: n.created_at
        }));

        return new Response(
          JSON.stringify(notes),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'POST') {
        const body = await req.json();
        
        if (!body.conteudo) {
          return new Response(
            JSON.stringify({ error: 'conteudo is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Note: author_id would need to be resolved from the API key owner
        // For now, we require it in the body or skip it
        const { data, error } = await supabase
          .from('internal_notes')
          .insert({
            conversation_id: id,
            content: body.conteudo,
            author_id: body.author_id || null
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            sucesso: true,
            nota: {
              id: data.id,
              conteudo: data.content,
              criada_em: data.created_at
            }
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // DELETE - Delete conversation
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id query parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-conversations:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
