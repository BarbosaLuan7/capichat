import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'manager' | 'agent' | 'viewer';
  tenantId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[admin-create-user] No authorization header');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // First, verify the caller is an admin using the anon client
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !caller) {
      console.error('[admin-create-user] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if caller is admin
    const { data: callerRole, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle();

    if (roleError) {
      console.error('[admin-create-user] Role fetch error:', roleError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (callerRole?.role !== 'admin') {
      console.error('[admin-create-user] Caller is not admin:', caller.id, callerRole?.role);
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateUserRequest = await req.json();
    const { email, password, name, role = 'agent', tenantId } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('[admin-create-user] Creating user:', email);

    // Create user in auth.users
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name },
    });

    if (createError) {
      console.error('[admin-create-user] Create user error:', createError);

      if (createError.message.includes('already been registered')) {
        return new Response(JSON.stringify({ error: 'Este email já está cadastrado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUser = authData.user;
    console.log('[admin-create-user] User created:', newUser.id);

    // The profile and role should be created by the trigger, but let's ensure they exist
    // Wait a bit for the trigger to execute
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update the profile with the correct name (trigger might have used email)
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ name })
      .eq('id', newUser.id);

    if (profileUpdateError) {
      console.error('[admin-create-user] Profile update error:', profileUpdateError);
    }

    // Update the role if different from default
    if (role !== 'agent') {
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.id);

      if (roleUpdateError) {
        console.error('[admin-create-user] Role update error:', roleUpdateError);
      }
    }

    // Add user to tenant if provided
    if (tenantId) {
      const { error: tenantError } = await supabaseAdmin.from('user_tenants').insert({
        user_id: newUser.id,
        tenant_id: tenantId,
        role: role,
        is_active: true,
      });

      if (tenantError) {
        console.error('[admin-create-user] Tenant assignment error:', tenantError);
      }
    }

    console.log('[admin-create-user] User setup complete:', newUser.id);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name,
          role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[admin-create-user] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
