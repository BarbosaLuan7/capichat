import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ====== ESTRUTURA LB ADV ======

const TENANT = {
  id: '8aa3e1e6-d96a-4efe-bb0b-7e49df710d25',
  name: 'LB ADV',
  slug: 'lb-adv',
  settings: {
    full_name: 'Luan Barbosa | Advocacia Especializada',
    description: 'Escritório de advocacia especializado em direito previdenciário e do consumidor',
  },
};

// Equipe extra a ser removida (tem WhatsApp configs que precisam ser movidos)
const EXTRA_TEAM_ID = '6aebcfb2-561e-49c9-997f-3c263c26e3a6';

// Equipe padrão para mover as WhatsApp configs
const DEFAULT_TEAM_ID = '19eac12b-a427-452d-9ab5-be18eb529045';

const DEFAULT_PASSWORD = 'GaranteDireito@2026';

interface TeamConfig {
  id: string;
  name: string;
  access_level: 'all' | 'team' | 'attendant';
  auto_distribution: boolean;
  is_default: boolean;
  description: string;
}

const TEAMS: TeamConfig[] = [
  // ÁREA PREVIDENCIÁRIA
  {
    id: '19eac12b-a427-452d-9ab5-be18eb529045',
    name: 'GD | Previdenciário 👴',
    access_level: 'team',
    auto_distribution: true,
    is_default: true,
    description: 'Atendimento inicial de casos INSS/BPC',
  },
  {
    id: '66292225-4ced-456a-acc4-9d475b5e2fb4',
    name: 'GD | Andamento - Prev ⚖️',
    access_level: 'team',
    auto_distribution: false,
    is_default: false,
    description: 'Acompanhamento de processos em andamento',
  },
  // ÁREA CONSUMIDOR
  {
    id: '9f32e277-aa4a-4bf3-ad5a-d072aa59d04a',
    name: '💜 Resolvoo | Atendimento Inicial',
    access_level: 'team',
    auto_distribution: false,
    is_default: false,
    description: 'Atendimento inicial de casos aéreos/consumidor',
  },
  {
    id: 'bf98ceb1-4271-4da6-9398-889be5fa5461',
    name: '📁 Resolvoo | Andamento Processual',
    access_level: 'team',
    auto_distribution: false,
    is_default: false,
    description: 'Acompanhamento de processos Resolvoo',
  },
  // AUTOMAÇÃO
  {
    id: '0c21f025-21b5-423d-be16-663eb9c2138b',
    name: 'IA - CAPI',
    access_level: 'attendant',
    auto_distribution: false,
    is_default: false,
    description: 'Atendimento automatizado via IA',
  },
];

interface UserConfig {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'agent';
  is_available: boolean;
  teams: Array<{ team_id: string; is_supervisor: boolean }>;
}

const USERS: UserConfig[] = [
  // ADMINS
  {
    name: 'Thaw',
    email: 'thawanrmichels@gmail.com',
    phone: '5541984406340',
    role: 'admin',
    is_available: false,
    teams: [{ team_id: '0c21f025-21b5-423d-be16-663eb9c2138b', is_supervisor: false }],
  },
  {
    name: 'Natalia Müller',
    email: 'najosoraal@gmail.com',
    phone: '5545999937713',
    role: 'admin',
    is_available: false,
    teams: [{ team_id: 'bf98ceb1-4271-4da6-9398-889be5fa5461', is_supervisor: false }],
  },
  {
    name: 'Luana Maestrelo',
    email: 'maestreloluana@gmail.com',
    phone: '5545999215298',
    role: 'admin',
    is_available: false,
    teams: [
      { team_id: '66292225-4ced-456a-acc4-9d475b5e2fb4', is_supervisor: false },
      { team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: false },
    ],
  },
  {
    name: 'Luan',
    email: 'luan@luan.com',
    phone: '',
    role: 'admin',
    is_available: false,
    teams: [],
  },
  // AGENTS
  {
    name: 'Marina Barbosa',
    email: 'matorresprado@hotmail.com',
    phone: '5545991159994',
    role: 'agent',
    is_available: false,
    teams: [
      { team_id: 'bf98ceb1-4271-4da6-9398-889be5fa5461', is_supervisor: false },
      { team_id: '66292225-4ced-456a-acc4-9d475b5e2fb4', is_supervisor: false },
      { team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: false },
    ],
  },
  {
    name: 'Lunny Sander',
    email: 'adv.lunnysander@gmail.com',
    phone: '5545988300704',
    role: 'agent',
    is_available: false,
    teams: [{ team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: false }],
  },
  {
    name: 'Jorge Moreira',
    email: 'm.jorgex@gmail.com',
    phone: '5542998274330',
    role: 'agent',
    is_available: true,
    teams: [{ team_id: '9f32e277-aa4a-4bf3-ad5a-d072aa59d04a', is_supervisor: true }],
  },
  {
    name: 'Anna Luiza',
    email: 'anna.albc2@gmail.com',
    phone: '5545984280988',
    role: 'agent',
    is_available: true,
    teams: [{ team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: true }],
  },
  {
    name: 'Ali Kanso',
    email: 'ali.kanso.br222@gmail.com',
    phone: '5545998476100',
    role: 'agent',
    is_available: true,
    teams: [{ team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: true }],
  },
  {
    name: 'Adv | Resolvoo',
    email: 'barbosaluan.adv@gmail.com',
    phone: '5545988419964',
    role: 'agent',
    is_available: false,
    teams: [{ team_id: 'bf98ceb1-4271-4da6-9398-889be5fa5461', is_supervisor: false }],
  },
];

interface SeedOptions {
  updateTenant?: boolean;
  cleanupExtraTeam?: boolean;
  updateTeams?: boolean;
  updateUsers?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can run seed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse options from request body
    let options: SeedOptions = {
      updateTenant: true,
      cleanupExtraTeam: true,
      updateTeams: true,
      updateUsers: true,
    };

    try {
      const body = await req.json();
      if (body?.options) {
        options = { ...options, ...body.options };
      }
    } catch {
      // Use default options if no body
    }

    console.log('Starting seed process with options:', options);

    const results = {
      tenant: { updated: false, error: undefined as string | undefined },
      cleanupTeam: { deleted: false, whatsappMoved: 0, error: undefined as string | undefined },
      teams: { created: 0, updated: 0, errors: [] as string[] },
      users: { created: 0, updated: 0, errors: [] as string[] },
      roles: { created: 0, updated: 0, errors: [] as string[] },
      teamMembers: { created: 0, deleted: 0, errors: [] as string[] },
    };

    // ===== STEP 1: Update Tenant =====
    if (options.updateTenant) {
      console.log('Updating tenant...');
      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update({
          name: TENANT.name,
          slug: TENANT.slug,
          settings: TENANT.settings,
        })
        .eq('id', TENANT.id);

      if (tenantError) {
        console.error('Error updating tenant:', tenantError);
        results.tenant.error = tenantError.message;
      } else {
        results.tenant.updated = true;
        console.log('Tenant updated to:', TENANT.name);
      }
    }

    // ===== STEP 2: Cleanup Extra Team =====
    if (options.cleanupExtraTeam) {
      console.log('Cleaning up extra team...');
      
      // Check if extra team exists
      const { data: extraTeam } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .eq('id', EXTRA_TEAM_ID)
        .single();

      if (extraTeam) {
        // Move WhatsApp configs to default team
        const { data: whatsappConfigs, error: whatsappError } = await supabaseAdmin
          .from('team_whatsapp_configs')
          .select('*')
          .eq('team_id', EXTRA_TEAM_ID);

        if (!whatsappError && whatsappConfigs && whatsappConfigs.length > 0) {
          console.log(`Found ${whatsappConfigs.length} WhatsApp configs to move`);
          
          for (const config of whatsappConfigs) {
            // Check if already exists in default team
            const { data: existing } = await supabaseAdmin
              .from('team_whatsapp_configs')
              .select('*')
              .eq('team_id', DEFAULT_TEAM_ID)
              .eq('whatsapp_config_id', config.whatsapp_config_id)
              .single();

            if (!existing) {
              const { error: insertError } = await supabaseAdmin
                .from('team_whatsapp_configs')
                .insert({
                  team_id: DEFAULT_TEAM_ID,
                  whatsapp_config_id: config.whatsapp_config_id,
                });

              if (!insertError) {
                results.cleanupTeam.whatsappMoved++;
              }
            }
          }

          // Delete old associations
          await supabaseAdmin
            .from('team_whatsapp_configs')
            .delete()
            .eq('team_id', EXTRA_TEAM_ID);
        }

        // Delete team members from extra team
        await supabaseAdmin
          .from('team_members')
          .delete()
          .eq('team_id', EXTRA_TEAM_ID);

        // Update conversations that reference this team to null or default
        await supabaseAdmin
          .from('conversations')
          .update({ team_id: DEFAULT_TEAM_ID })
          .eq('team_id', EXTRA_TEAM_ID);

        // Delete the extra team
        const { error: deleteError } = await supabaseAdmin
          .from('teams')
          .delete()
          .eq('id', EXTRA_TEAM_ID);

        if (deleteError) {
          console.error('Error deleting extra team:', deleteError);
          results.cleanupTeam.error = deleteError.message;
        } else {
          results.cleanupTeam.deleted = true;
          console.log('Extra team deleted:', extraTeam.name);
        }
      } else {
        console.log('Extra team not found, skipping cleanup');
      }
    }

    // ===== STEP 3: Create/Update Teams =====
    if (options.updateTeams) {
      console.log('Creating/updating teams...');
      
      // First, ensure only one team is default
      if (TEAMS.some(t => t.is_default)) {
        await supabaseAdmin
          .from('teams')
          .update({ is_default: false })
          .eq('tenant_id', TENANT.id);
      }

      for (const team of TEAMS) {
        const { error } = await supabaseAdmin
          .from('teams')
          .upsert({
            id: team.id,
            name: team.name,
            access_level: team.access_level,
            auto_distribution: team.auto_distribution,
            is_default: team.is_default,
            tenant_id: TENANT.id,
          }, { onConflict: 'id' });

        if (error) {
          console.error(`Error creating team ${team.name}:`, error);
          results.teams.errors.push(`${team.name}: ${error.message}`);
        } else {
          results.teams.created++;
          console.log(`Team upserted: ${team.name}`);
        }
      }
    }

    // ===== STEP 4: Create/Update Users =====
    if (options.updateUsers) {
      console.log('Creating/updating users...');
      
      for (const userData of USERS) {
        // Try to create auth user
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { name: userData.name },
        });

        let actualUserId: string | undefined;

        if (createError) {
          if (createError.message?.includes('already been registered')) {
            console.log(`User ${userData.email} already exists, updating...`);
            results.users.updated++;
            
            // Get existing user ID
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email === userData.email);
            actualUserId = existingUser?.id;
          } else {
            console.error(`Error creating user ${userData.email}:`, createError);
            results.users.errors.push(`${userData.email}: ${createError.message}`);
            continue;
          }
        } else {
          results.users.created++;
          actualUserId = authData?.user?.id;
          console.log(`Auth user created: ${userData.email}`);
        }

        if (!actualUserId) {
          console.error(`Could not find user ID for ${userData.email}`);
          continue;
        }

        // Create/Update Profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: actualUserId,
            name: userData.name,
            email: userData.email,
            phone: userData.phone || null,
            is_available: userData.is_available,
            is_active: true,
          }, { onConflict: 'id' });

        if (profileError) {
          console.error(`Error creating profile for ${userData.email}:`, profileError);
        }

        // Update Role - delete existing, then insert
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', actualUserId);

        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: actualUserId,
            role: userData.role,
          });

        if (roleError) {
          console.error(`Error creating role for ${userData.email}:`, roleError);
          results.roles.errors.push(`${userData.email}: ${roleError.message}`);
        } else {
          results.roles.created++;
        }

        // Update User-Tenant association
        const { error: tenantError } = await supabaseAdmin
          .from('user_tenants')
          .upsert({
            user_id: actualUserId,
            tenant_id: TENANT.id,
            role: userData.role,
            is_active: true,
          }, { onConflict: 'user_id,tenant_id' });

        if (tenantError) {
          console.error(`Error creating user_tenant for ${userData.email}:`, tenantError);
        }

        // Sync Team Members - delete old, insert new
        const { data: oldMembers } = await supabaseAdmin
          .from('team_members')
          .select('team_id')
          .eq('user_id', actualUserId);

        if (oldMembers) {
          for (const old of oldMembers) {
            // Only delete if not in new config
            if (!userData.teams.some(t => t.team_id === old.team_id)) {
              await supabaseAdmin
                .from('team_members')
                .delete()
                .eq('user_id', actualUserId)
                .eq('team_id', old.team_id);
              results.teamMembers.deleted++;
            }
          }
        }

        // Insert new team memberships
        for (const teamAssoc of userData.teams) {
          const { error: memberError } = await supabaseAdmin
            .from('team_members')
            .upsert({
              team_id: teamAssoc.team_id,
              user_id: actualUserId,
              is_supervisor: teamAssoc.is_supervisor,
            }, { onConflict: 'team_id,user_id' });

          if (memberError) {
            console.error(`Error adding ${userData.email} to team ${teamAssoc.team_id}:`, memberError);
            results.teamMembers.errors.push(`${userData.email} -> ${teamAssoc.team_id}: ${memberError.message}`);
          } else {
            results.teamMembers.created++;
          }
        }
      }
    }

    console.log('Seed process completed!');
    console.log('Results:', JSON.stringify(results, null, 2));

    const summary = `Tenant: ${results.tenant.updated ? 'atualizado' : 'não alterado'}, ` +
      `Equipes: ${results.teams.created}, ` +
      `Usuários: ${results.users.created + results.users.updated}, ` +
      `Membros: ${results.teamMembers.created}`;

    return new Response(JSON.stringify({
      success: true,
      results,
      summary,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Seed error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
