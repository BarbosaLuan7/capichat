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

    console.log('[api-teams] API key validated');

    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    // GET /api-teams - List teams
    if (method === 'GET' && !id) {
      const { data: teams, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_members(user_id, is_supervisor, profiles(id, name, is_available))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return safeErrorResponse(error, 'Error listing teams');
      }

      const transformed = (teams || []).map((team: any) => {
        const members = team.team_members || [];
        const availableMembers = members.filter((m: any) => m.profiles?.is_available);
        
        return {
          id: `eqp_${team.id.slice(0, 8)}`,
          nome: team.name,
          nivel_acesso: team.access_level || 'all',
          distribuicao_automatica: team.auto_distribution || false,
          equipe_padrao: team.is_default || false,
          total_membros: members.length,
          membros_disponiveis: availableMembers.length,
          criado_em: team.created_at
        };
      });

      console.log('[api-teams] Listed', transformed.length, 'teams');

      return new Response(
        JSON.stringify({ dados: transformed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-teams?id=xxx - Get single team with members
    if (method === 'GET' && id && !action) {
      const { data: team, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_members(user_id, is_supervisor, profiles(id, name, email, is_available)),
          team_whatsapp_configs(whatsapp_config_id, whatsapp_config:whatsapp_config_safe(id, name, provider, phone_number))
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return safeErrorResponse(error, 'Error fetching team');
      }

      if (!team) {
        return new Response(
          JSON.stringify({ success: false, error: 'Team not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const members = team.team_members || [];
      const availableMembers = members.filter((m: any) => m.profiles?.is_available);

      const transformed = {
        id: `eqp_${team.id.slice(0, 8)}`,
        nome: team.name,
        nivel_acesso: team.access_level || 'all',
        distribuicao_automatica: team.auto_distribution || false,
        equipe_padrao: team.is_default || false,
        total_membros: members.length,
        membros_disponiveis: availableMembers.length,
        criado_em: team.created_at,
        membros: members.map((m: any) => ({
          id: m.profiles?.id ? `usr_${m.profiles.id.slice(0, 8)}` : null,
          nome: m.profiles?.name,
          email: m.profiles?.email,
          supervisor: m.is_supervisor,
          disponivel: m.profiles?.is_available
        })),
        canais: (team.team_whatsapp_configs || []).map((twc: any) => ({
          id: twc.whatsapp_config?.id ? `inst_${twc.whatsapp_config.id.slice(0, 8)}` : null,
          tipo: 'whatsapp',
          nome: twc.whatsapp_config?.name,
          telefone: formatTelefone(twc.whatsapp_config?.phone_number)
        })).filter((c: any) => c.id)
      };

      return new Response(
        JSON.stringify(transformed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-teams?id=xxx&action=canais - List team channels
    if (method === 'GET' && id && action === 'canais') {
      const { data, error } = await supabase
        .from('team_whatsapp_configs')
        .select(`
          whatsapp_config:whatsapp_config_safe(id, name, provider, phone_number, is_active)
        `)
        .eq('team_id', id);

      if (error) {
        return safeErrorResponse(error, 'Error fetching team channels');
      }

      const channels = (data || []).map((twc: any) => ({
        id: twc.whatsapp_config?.id ? `inst_${twc.whatsapp_config.id.slice(0, 8)}` : null,
        tipo: 'whatsapp',
        nome: twc.whatsapp_config?.name,
        telefone: formatTelefone(twc.whatsapp_config?.phone_number),
        ativo: twc.whatsapp_config?.is_active
      })).filter((c: any) => c.id);

      return new Response(
        JSON.stringify(channels),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-teams - Create team
    if (method === 'POST' && !id) {
      const body = await req.json();

      if (!body.nome) {
        return new Response(
          JSON.stringify({ success: false, error: 'nome is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: newTeam, error } = await supabase
        .from('teams')
        .insert({
          name: body.nome,
          access_level: body.nivel_acesso || 'team',
          auto_distribution: body.distribuicao_automatica || false,
          is_default: false
        })
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error creating team');
      }

      console.log('[api-teams] Team created:', newTeam.id);

      return new Response(
        JSON.stringify({
          id: `eqp_${newTeam.id.slice(0, 8)}`,
          nome: newTeam.name,
          nivel_acesso: newTeam.access_level,
          distribuicao_automatica: newTeam.auto_distribution,
          equipe_padrao: newTeam.is_default,
          criado_em: newTeam.created_at
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-teams?id=xxx - Update team
    if (method === 'PUT' && id && !action) {
      const body = await req.json();

      const updateData: Record<string, unknown> = {};
      if (body.nome !== undefined) updateData.name = body.nome;
      if (body.nivel_acesso !== undefined) updateData.access_level = body.nivel_acesso;
      if (body.distribuicao_automatica !== undefined) updateData.auto_distribution = body.distribuicao_automatica;
      if (body.equipe_padrao !== undefined) updateData.is_default = body.equipe_padrao;

      const { data: updatedTeam, error } = await supabase
        .from('teams')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return safeErrorResponse(error, 'Error updating team');
      }

      console.log('[api-teams] Team updated:', id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          equipe: {
            id: `eqp_${updatedTeam.id.slice(0, 8)}`,
            nome: updatedTeam.name,
            nivel_acesso: updatedTeam.access_level,
            distribuicao_automatica: updatedTeam.auto_distribution,
            equipe_padrao: updatedTeam.is_default
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-teams?id=xxx&action=usuarios - Update team members
    if (method === 'PUT' && id && action === 'usuarios') {
      const body = await req.json();
      const usuarios = body.usuarios || [];

      // Delete existing memberships for this team
      await supabase
        .from('team_members')
        .delete()
        .eq('team_id', id);

      // Insert new memberships
      if (usuarios.length > 0) {
        const memberships = usuarios.map((u: any) => ({
          team_id: id,
          user_id: u.usuario_id,
          is_supervisor: u.supervisor || false
        }));

        const { error: insertError } = await supabase
          .from('team_members')
          .insert(memberships);

        if (insertError) {
          return safeErrorResponse(insertError, 'Error updating team members');
        }
      }

      console.log('[api-teams] Members updated for team:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Membros atualizados com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-teams?id=xxx - Delete team
    if (method === 'DELETE' && id) {
      // Check if team has members
      const { data: members } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', id);

      if (members && members.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot delete team with members' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) {
        return safeErrorResponse(error, 'Error deleting team');
      }

      console.log('[api-teams] Team deleted:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Equipe removida com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed or invalid action' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-teams] Error:', error);
    return safeErrorResponse(error, 'Internal server error');
  }
});
