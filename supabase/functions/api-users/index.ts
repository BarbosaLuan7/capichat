import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Role mapping between API (Portuguese) and database (English)
const roleMap: Record<string, string> = {
  'administrador': 'admin',
  'gerente': 'manager',
  'atendente': 'agent',
  'visualizador': 'viewer',
  'admin': 'admin',
  'manager': 'manager',
  'agent': 'agent',
  'viewer': 'viewer'
};

const roleMapReverse: Record<string, string> = {
  'admin': 'administrador',
  'manager': 'gerente',
  'agent': 'atendente',
  'viewer': 'visualizador'
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

    console.log('[api-users] API key validated');

    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const page = parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('por_pagina') || url.searchParams.get('page_size') || '50');

    // GET /api-users - List users
    if (method === 'GET' && !id) {
      const ativo = url.searchParams.get('ativo');
      const disponivel = url.searchParams.get('disponivel');
      const equipeId = url.searchParams.get('equipe_id');
      const perfil = url.searchParams.get('perfil');

      let query = supabase
        .from('profiles')
        .select(`
          *,
          user_roles(role),
          team_members(team_id, is_supervisor, teams(id, name))
        `, { count: 'exact' });

      if (ativo !== null) {
        query = query.eq('is_active', ativo === 'true');
      }
      if (disponivel !== null) {
        query = query.eq('is_available', disponivel === 'true');
      }
      if (equipeId) {
        query = query.eq('team_members.team_id', equipeId);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        return safeErrorResponse(error, 'Error listing users');
      }

      // Filter by role if specified
      let filteredData = data || [];
      if (perfil) {
        const dbRole = roleMap[perfil] || perfil;
        filteredData = filteredData.filter((u: any) => 
          u.user_roles?.some((r: any) => r.role === dbRole)
        );
      }

      // Transform response
      const transformed = filteredData.map((user: any) => ({
        id: `usr_${user.id.slice(0, 8)}`,
        nome: user.name,
        email: user.email,
        telefone: formatTelefone(user.phone),
        avatar_url: user.avatar,
        perfil: roleMapReverse[user.user_roles?.[0]?.role] || 'atendente',
        ativo: user.is_active,
        disponivel: user.is_available,
        dono_conta: user.is_account_owner,
        equipes: (user.team_members || []).map((tm: any) => ({
          id: tm.teams?.id ? `eqp_${tm.teams.id.slice(0, 8)}` : null,
          nome: tm.teams?.name,
          supervisor: tm.is_supervisor
        })).filter((e: any) => e.id),
        criado_em: user.created_at
      }));

      console.log('[api-users] Listed', transformed.length, 'users');

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

    // GET /api-users?id=xxx - Get single user
    if (method === 'GET' && id && !action) {
      const { data: user, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles(role),
          team_members(team_id, is_supervisor, teams(id, name))
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return safeErrorResponse(error, 'Error fetching user');
      }

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const transformed = {
        id: `usr_${user.id.slice(0, 8)}`,
        nome: user.name,
        email: user.email,
        telefone: formatTelefone(user.phone),
        avatar_url: user.avatar,
        perfil: roleMapReverse[user.user_roles?.[0]?.role] || 'atendente',
        ativo: user.is_active,
        disponivel: user.is_available,
        dono_conta: user.is_account_owner,
        equipes: (user.team_members || []).map((tm: any) => ({
          id: tm.teams?.id ? `eqp_${tm.teams.id.slice(0, 8)}` : null,
          nome: tm.teams?.name,
          supervisor: tm.is_supervisor
        })).filter((e: any) => e.id),
        criado_em: user.created_at
      };

      return new Response(
        JSON.stringify(transformed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-users?id=xxx - Update user
    if (method === 'PUT' && id && !action) {
      const body = await req.json();

      const updateData: Record<string, unknown> = {};
      if (body.nome !== undefined) updateData.name = body.nome;
      if (body.telefone !== undefined) updateData.phone = body.telefone;
      if (body.ativo !== undefined) updateData.is_active = body.ativo;
      if (body.disponivel !== undefined) updateData.is_available = body.disponivel;

      const { data: updatedUser, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error updating user');
      }

      console.log('[api-users] User updated:', id);

      return new Response(
        JSON.stringify({ sucesso: true, usuario: updatedUser }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-users?id=xxx - Remove user
    if (method === 'DELETE' && id) {
      // Deactivate user instead of deleting
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        return safeErrorResponse(error, 'Error removing user');
      }

      console.log('[api-users] User deactivated:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Usuário removido com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-users?id=xxx&action=equipes - Update user teams
    if (method === 'POST' && id && action === 'equipes') {
      const body = await req.json();
      const equipes = body.equipes || [];

      // Delete existing team memberships
      await supabase
        .from('team_members')
        .delete()
        .eq('user_id', id);

      // Insert new memberships
      if (equipes.length > 0) {
        const memberships = equipes.map((e: any) => ({
          user_id: id,
          team_id: e.equipe_id,
          is_supervisor: e.supervisor || false
        }));

        const { error: insertError } = await supabase
          .from('team_members')
          .insert(memberships);

        if (insertError) {
          return safeErrorResponse(insertError, 'Error updating user teams');
        }
      }

      console.log('[api-users] Teams updated for user:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Equipes atualizadas com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-users?id=xxx&action=status - Change user status
    if (method === 'POST' && id && action === 'status') {
      const body = await req.json();

      const { error } = await supabase
        .from('profiles')
        .update({ is_active: body.ativo })
        .eq('id', id);

      if (error) {
        return safeErrorResponse(error, 'Error updating user status');
      }

      console.log('[api-users] Status updated for user:', id, '->', body.ativo);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: body.ativo ? 'Usuário ativado' : 'Usuário desativado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-users?id=xxx&action=disponibilidade - Change availability
    if (method === 'POST' && id && action === 'disponibilidade') {
      const body = await req.json();

      const { data: updatedUser, error } = await supabase
        .from('profiles')
        .update({ is_available: body.disponivel })
        .eq('id', id)
        .select('id, name, is_available')
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error updating user availability');
      }

      console.log('[api-users] Availability updated for user:', id, '->', body.disponivel);

      return new Response(
        JSON.stringify({
          sucesso: true,
          usuario: {
            id: updatedUser.id,
            nome: updatedUser.name,
            disponivel: updatedUser.is_available
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-users - Create user (basic - just profile, no auth)
    if (method === 'POST' && !id) {
      const body = await req.json();

      if (!body.nome || !body.email) {
        return new Response(
          JSON.stringify({ success: false, error: 'nome and email are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Note: Full user creation with auth should use admin-create-user function
      // This endpoint creates a basic profile entry only
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User creation via API requires authentication. Use the admin interface.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed or invalid action' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-users] Error:', error);
    return safeErrorResponse(error, 'Internal server error');
  }
});
