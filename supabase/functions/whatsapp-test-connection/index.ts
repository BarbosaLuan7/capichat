import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestConnectionPayload {
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name?: string;
}

async function testWAHA(config: TestConnectionPayload): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  try {
    const endpoint = `/api/sessions/${config.instance_name || 'default'}`;
    const response = await fetch(`${config.base_url}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || 'Erro ao conectar com WAHA' };
    }

    return { 
      success: true, 
      status: data.status || 'connected',
      phone: data.me?.id?.replace('@c.us', '') || data.me?.pushname,
    };
  } catch (error: unknown) {
    return { success: false, error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function testEvolution(config: TestConnectionPayload): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  try {
    const endpoint = `/instance/connectionState/${config.instance_name || 'default'}`;
    const response = await fetch(`${config.base_url}${endpoint}`, {
      method: 'GET',
      headers: {
        'apikey': config.api_key,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || 'Erro ao conectar com Evolution API' };
    }

    // Also try to get instance info
    const infoResponse = await fetch(`${config.base_url}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': config.api_key,
      },
    });

    let phone = '';
    if (infoResponse.ok) {
      const instances = await infoResponse.json();
      const instance = instances.find((i: { name: string }) => i.name === (config.instance_name || 'default'));
      phone = instance?.ownerJid?.replace('@s.whatsapp.net', '') || '';
    }

    return { 
      success: data.state === 'open', 
      status: data.state,
      phone,
      error: data.state !== 'open' ? 'Instância não está conectada' : undefined,
    };
  } catch (error: unknown) {
    return { success: false, error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function testZAPI(config: TestConnectionPayload): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  try {
    const response = await fetch(`${config.base_url}/status`, {
      method: 'GET',
      headers: {
        'Client-Token': config.api_key,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || 'Erro ao conectar com Z-API' };
    }

    return { 
      success: data.connected === true, 
      status: data.connected ? 'connected' : 'disconnected',
      phone: data.phone,
      error: !data.connected ? 'Instância não está conectada' : undefined,
    };
  } catch (error: unknown) {
    return { success: false, error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function testCustom(config: TestConnectionPayload): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  try {
    // Try to hit the base URL with a health check
    const response = await fetch(`${config.base_url}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
      },
    });

    if (!response.ok) {
      // Try base URL directly
      const baseResponse = await fetch(config.base_url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
        },
      });

      if (!baseResponse.ok) {
        return { success: false, error: 'Servidor não respondeu corretamente' };
      }
    }

    return { success: true, status: 'connected' };
  } catch (error: unknown) {
    return { success: false, error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get user auth from request
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: TestConnectionPayload = await req.json();
    console.log('[whatsapp-test-connection] Testing provider:', payload.provider);

    if (!payload.provider || !payload.base_url || !payload.api_key) {
      return new Response(
        JSON.stringify({ error: 'provider, base_url and api_key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { success: boolean; status?: string; phone?: string; error?: string };

    switch (payload.provider) {
      case 'waha':
        result = await testWAHA(payload);
        break;
      case 'evolution':
        result = await testEvolution(payload);
        break;
      case 'z-api':
        result = await testZAPI(payload);
        break;
      case 'custom':
        result = await testCustom(payload);
        break;
      default:
        result = { success: false, error: 'Unknown provider' };
    }

    console.log('[whatsapp-test-connection] Test result:', result);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[whatsapp-test-connection] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
