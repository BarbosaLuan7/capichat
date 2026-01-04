import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TENANT_ID = '8aa3e1e6-d96a-4efe-bb0b-7e49df710d25';
const DEFAULT_PASSWORD = 'GaranteDireito@2026';

const TEAMS = [
  {
    id: '19eac12b-a427-452d-9ab5-be18eb529045',
    name: 'GD | Previdenciário 👴',
    access_level: 'team',
    auto_distribution: true,
    is_default: true,
  },
  {
    id: 'bf98ceb1-4271-4da6-9398-889be5fa5461',
    name: '📁 Resolvoo | Andamento Processual',
    access_level: 'team',
    auto_distribution: false,
    is_default: false,
  },
  {
    id: '9f32e277-aa4a-4bf3-ad5a-d072aa59d04a',
    name: '💜 Resolvoo | Atendimento Inicial',
    access_level: 'team',
    auto_distribution: false,
    is_default: false,
  },
  {
    id: '66292225-4ced-456a-acc4-9d475b5e2fb4',
    name: 'GD | Andamento - Prev ⚖️',
    access_level: 'team',
    auto_distribution: false,
    is_default: false,
  },
  {
    id: '0c21f025-21b5-423d-be16-663eb9c2138b',
    name: 'IA - CAPI',
    access_level: 'attendant',
    auto_distribution: false,
    is_default: false,
  },
];

const USERS = [
  {
    id: '084fa342-8324-48dc-b7dc-91f95b1c1622',
    name: 'Thaw',
    email: 'thawanrmichels@gmail.com',
    phone: '5541984406340',
    role: 'admin',
    is_available: false,
    teams: [{ team_id: '0c21f025-21b5-423d-be16-663eb9c2138b', is_supervisor: false }],
  },
  {
    id: '2895e07d-9f68-4e9c-b50f-c1cde0de37ed',
    name: 'Natalia Müller',
    email: 'najosoraal@gmail.com',
    phone: '5545999937713',
    role: 'admin',
    is_available: false,
    teams: [{ team_id: 'bf98ceb1-4271-4da6-9398-889be5fa5461', is_supervisor: false }],
  },
  {
    id: '92f88c55-0844-4579-8042-d4af2820660b',
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
    id: '4fdede30-33da-4ece-a4aa-517af4a09f57',
    name: 'Lunny Sander',
    email: 'adv.lunnysander@gmail.com',
    phone: '5545988300704',
    role: 'agent',
    is_available: false,
    teams: [{ team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: false }],
  },
  {
    id: 'ece103c7-9da5-44ea-88e7-4789f4afdf40',
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
    id: '737b7efc-7b98-4095-8e7d-67335d1a1b84',
    name: 'Jorge Moreira',
    email: 'm.jorgex@gmail.com',
    phone: '5542998274330',
    role: 'agent',
    is_available: true,
    teams: [{ team_id: '9f32e277-aa4a-4bf3-ad5a-d072aa59d04a', is_supervisor: true }],
  },
  {
    id: '31bfe1c9-dade-4d38-b932-5ccefef597e5',
    name: 'Anna Luiza',
    email: 'anna.albc2@gmail.com',
    phone: '5545984280988',
    role: 'agent',
    is_available: true,
    teams: [{ team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: true }],
  },
  {
    id: '98104ff5-72e8-429e-8cda-c9a636af3e44',
    name: 'Ali Kanso',
    email: 'ali.kanso.br222@gmail.com',
    phone: '5545998476100',
    role: 'agent',
    is_available: true,
    teams: [{ team_id: '19eac12b-a427-452d-9ab5-be18eb529045', is_supervisor: true }],
  },
  {
    id: '5886f473-a36e-43d0-b145-f5814fc55a1b',
    name: 'Adv | Resolvoo',
    email: 'barbosaluan.adv@gmail.com',
    phone: '5545988419964',
    role: 'agent',
    is_available: false,
    teams: [{ team_id: 'bf98ceb1-4271-4da6-9398-889be5fa5461', is_supervisor: false }],
  },
];

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

    const results = {
      teams: { created: 0, updated: 0, errors: [] as string[] },
      users: { created: 0, updated: 0, errors: [] as string[] },
      profiles: { created: 0, updated: 0, errors: [] as string[] },
      roles: { created: 0, updated: 0, errors: [] as string[] },
      members: { created: 0, updated: 0, errors: [] as string[] },
      userTenants: { created: 0, updated: 0, errors: [] as string[] },
    };

    console.log('Starting seed process...');

    // Step 1: Create/Update Teams
    console.log('Creating teams...');
    for (const team of TEAMS) {
      const { error } = await supabaseAdmin
        .from('teams')
        .upsert({
          id: team.id,
          name: team.name,
          access_level: team.access_level,
          auto_distribution: team.auto_distribution,
          is_default: team.is_default,
          tenant_id: TENANT_ID,
        }, { onConflict: 'id' });

      if (error) {
        console.error(`Error creating team ${team.name}:`, error);
        results.teams.errors.push(`${team.name}: ${error.message}`);
      } else {
        results.teams.created++;
        console.log(`Team created/updated: ${team.name}`);
      }
    }

    // Step 2: Create Users in Auth + Profiles + Roles + Team Members
    console.log('Creating users...');
    for (const userData of USERS) {
      // Create auth user
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { name: userData.name },
      });

      if (createError) {
        if (createError.message?.includes('already been registered')) {
          console.log(`User ${userData.email} already exists, updating profile...`);
          results.users.updated++;
        } else {
          console.error(`Error creating user ${userData.email}:`, createError);
          results.users.errors.push(`${userData.email}: ${createError.message}`);
          continue;
        }
      } else {
        results.users.created++;
        console.log(`Auth user created: ${userData.email}`);
      }

      // Get the actual user ID (might be different if user already existed)
      let actualUserId = authData?.user?.id;
      if (!actualUserId) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === userData.email);
        actualUserId = existingUser?.id;
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
          phone: userData.phone,
          is_available: userData.is_available,
          is_active: true,
        }, { onConflict: 'id' });

      if (profileError) {
        console.error(`Error creating profile for ${userData.email}:`, profileError);
        results.profiles.errors.push(`${userData.email}: ${profileError.message}`);
      } else {
        results.profiles.created++;
        console.log(`Profile created/updated: ${userData.email}`);
      }

      // Create/Update Role - delete existing roles first, then insert the correct one
      const { error: deleteRoleError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', actualUserId);

      if (deleteRoleError) {
        console.error(`Error deleting existing roles for ${userData.email}:`, deleteRoleError);
      }

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
        console.log(`Role created/updated: ${userData.email} -> ${userData.role}`);
      }

      // Create/Update User-Tenant association
      const { error: tenantError } = await supabaseAdmin
        .from('user_tenants')
        .upsert({
          user_id: actualUserId,
          tenant_id: TENANT_ID,
          role: userData.role,
          is_active: true,
        }, { onConflict: 'user_id,tenant_id' });

      if (tenantError) {
        console.error(`Error creating user_tenant for ${userData.email}:`, tenantError);
        results.userTenants.errors.push(`${userData.email}: ${tenantError.message}`);
      } else {
        results.userTenants.created++;
        console.log(`User-tenant association created: ${userData.email}`);
      }

      // Create Team Members
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
          results.members.errors.push(`${userData.email} -> ${teamAssoc.team_id}: ${memberError.message}`);
        } else {
          results.members.created++;
          console.log(`Team member added: ${userData.email} -> ${teamAssoc.team_id} (supervisor: ${teamAssoc.is_supervisor})`);
        }
      }
    }

    console.log('Seed process completed!');
    console.log('Results:', JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({
      success: true,
      message: 'Seed completed successfully',
      results,
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
