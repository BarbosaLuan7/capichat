import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    console.log('[api-tasks] API key validated');

    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '50');

    // GET /api-tasks - List tasks
    if (method === 'GET' && !id) {
      const status = url.searchParams.get('status');
      const assignedTo = url.searchParams.get('assigned_to');
      const leadId = url.searchParams.get('lead_id');
      const priority = url.searchParams.get('priority');

      // Use simple join without FK hint - assigned_to references auth.users, not profiles directly
      let query = supabase
        .from('tasks')
        .select(`
          *,
          lead:leads(id, name, phone)
        `, { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (leadId) query = query.eq('lead_id', leadId);
      if (priority) query = query.eq('priority', priority);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        return safeErrorResponse(error, 'Error listing tasks');
      }

      // Fetch assignee names separately
      const assigneeIds = [...new Set((data || []).map((t: any) => t.assigned_to).filter(Boolean))];
      const { data: assigneesData } = assigneeIds.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', assigneeIds)
        : { data: [] };
      
      const assigneesMap = new Map<string, string>();
      (assigneesData || []).forEach((p: any) => assigneesMap.set(p.id, p.name));

      const transformed = (data || []).map((task: any) => ({
        id: `task_${task.id.slice(0, 8)}`,
        titulo: task.title,
        descricao: task.description,
        status: task.status,
        prioridade: task.priority,
        prazo: task.due_date,
        responsavel: task.assigned_to ? {
          id: `usr_${task.assigned_to.slice(0, 8)}`,
          nome: assigneesMap.get(task.assigned_to) || 'Unknown'
        } : null,
        contato: task.lead ? {
          id: `cnt_${task.lead.id.slice(0, 8)}`,
          nome: task.lead.name,
          telefone: formatTelefone(task.lead.phone)
        } : null,
        criado_em: task.created_at,
        atualizado_em: task.updated_at
      }));

      console.log('[api-tasks] Listed', transformed.length, 'tasks');

      return new Response(
        JSON.stringify({
          dados: transformed,
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

    // GET /api-tasks?id=xxx - Get single task
    if (method === 'GET' && id && !action) {
      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return safeErrorResponse(error, 'Error fetching task');
      }

      if (!task) {
        return new Response(
          JSON.stringify({ success: false, error: 'Task not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch assignee name separately
      let assigneeName = null;
      if (task.assigned_to) {
        const { data: assignee } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', task.assigned_to)
          .maybeSingle();
        assigneeName = assignee?.name;
      }

      return new Response(
        JSON.stringify({
          id: `task_${task.id.slice(0, 8)}`,
          titulo: task.title,
          descricao: task.description,
          status: task.status,
          prioridade: task.priority,
          prazo: task.due_date,
          subtarefas: task.subtasks,
          responsavel: task.assigned_to ? {
            id: `usr_${task.assigned_to.slice(0, 8)}`,
            nome: assigneeName || 'Unknown'
          } : null,
          contato: task.lead ? {
            id: `cnt_${task.lead.id.slice(0, 8)}`,
            nome: task.lead.name,
            telefone: formatTelefone(task.lead.phone)
          } : null,
          criado_em: task.created_at,
          atualizado_em: task.updated_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-tasks - Create task
    if (method === 'POST' && !id) {
      const body = await req.json();

      // Accept both PT and EN parameter names
      const titulo = body.titulo || body.title;
      const descricao = body.descricao || body.description;
      const responsavelId = body.responsavel_id || body.assigned_to;
      const contatoId = body.contato_id || body.lead_id;
      const prioridade = body.prioridade || body.priority || 'medium';
      const prazo = body.data_vencimento || body.prazo || body.due_date;
      const tenantId = body.tenant_id;

      if (!titulo || !responsavelId) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Campos obrigatórios: titulo, responsavel_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          title: titulo,
          description: descricao || null,
          assigned_to: responsavelId,
          lead_id: contatoId || null,
          due_date: prazo || null,
          priority: prioridade,
          status: 'todo',
          tenant_id: tenantId || null
        })
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .single();

      if (error) {
        return safeErrorResponse(error, 'Erro ao criar tarefa');
      }

      // Fetch assignee name separately
      let assigneeName = null;
      if (newTask.assigned_to) {
        const { data: assignee } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', newTask.assigned_to)
          .maybeSingle();
        assigneeName = assignee?.name;
      }

      console.log('[api-tasks] Tarefa criada:', newTask.id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          tarefa: {
            id: `task_${newTask.id.slice(0, 8)}`,
            titulo: newTask.title,
            descricao: newTask.description,
            status: newTask.status,
            prioridade: newTask.priority,
            prazo: newTask.due_date,
            responsavel: newTask.assigned_to ? {
              id: `usr_${newTask.assigned_to.slice(0, 8)}`,
              nome: assigneeName || 'Unknown'
            } : null,
            contato: newTask.lead ? {
              id: `cnt_${newTask.lead.id.slice(0, 8)}`,
              nome: newTask.lead.name
            } : null,
            criado_em: newTask.created_at
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-tasks?id=xxx - Update task
    if (method === 'PUT' && id && !action) {
      const body = await req.json();

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      // Accept both PT and EN parameter names
      if (body.titulo !== undefined || body.title !== undefined) {
        updateData.title = body.titulo || body.title;
      }
      if (body.descricao !== undefined || body.description !== undefined) {
        updateData.description = body.descricao || body.description;
      }
      if (body.prazo !== undefined || body.data_vencimento !== undefined || body.due_date !== undefined) {
        updateData.due_date = body.prazo || body.data_vencimento || body.due_date;
      }
      if (body.prioridade !== undefined || body.priority !== undefined) {
        updateData.priority = body.prioridade || body.priority;
      }
      if (body.status !== undefined) updateData.status = body.status;
      if (body.responsavel_id !== undefined || body.assigned_to !== undefined) {
        updateData.assigned_to = body.responsavel_id || body.assigned_to;
      }
      if (body.subtarefas !== undefined || body.subtasks !== undefined) {
        updateData.subtasks = body.subtarefas || body.subtasks;
      }

      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Erro ao atualizar tarefa');
      }

      console.log('[api-tasks] Tarefa atualizada:', id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          tarefa: {
            id: `task_${updatedTask.id.slice(0, 8)}`,
            titulo: updatedTask.title,
            status: updatedTask.status,
            atualizado_em: updatedTask.updated_at
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-tasks?id=xxx&action=concluir - Complete task
    if (method === 'POST' && id && action === 'concluir') {
      const { data: completedTask, error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error completing task');
      }

      console.log('[api-tasks] Task completed:', id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          mensagem: 'Tarefa concluída com sucesso',
          tarefa: {
            id: `task_${completedTask.id.slice(0, 8)}`,
            titulo: completedTask.title,
            status: completedTask.status
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-tasks?id=xxx - Delete task
    if (method === 'DELETE' && id) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) {
        return safeErrorResponse(error, 'Error deleting task');
      }

      console.log('[api-tasks] Task deleted:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Tarefa removida com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed or invalid action' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-tasks] Error:', error);
    return safeErrorResponse(error, 'Internal server error');
  }
});
