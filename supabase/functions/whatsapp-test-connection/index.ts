import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Normaliza URL removendo barras finais
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// Tenta WAHA com múltiplos formatos de autenticação
async function testWAHA(
  config: TestConnectionPayload
): Promise<{
  success: boolean;
  status?: string;
  phone?: string;
  engine?: string;
  error?: string;
  authFormat?: string;
}> {
  const baseUrl = normalizeUrl(config.base_url);
  const sessionName = config.instance_name || 'default';
  const endpoint = `/api/sessions/${sessionName}`;
  const url = `${baseUrl}${endpoint}`;

  console.log('[WAHA] Testando conexão:', { url, sessionName });

  // Formatos de autenticação suportados pelo WAHA
  const authFormats: Array<{ name: string; headers: Record<string, string> }> = [
    { name: 'X-Api-Key', headers: { 'X-Api-Key': config.api_key } },
    { name: 'Bearer', headers: { Authorization: `Bearer ${config.api_key}` } },
    { name: 'ApiKey (sem Bearer)', headers: { Authorization: config.api_key } },
  ];

  for (const authFormat of authFormats) {
    try {
      console.log(`[WAHA] Tentando formato: ${authFormat.name}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: authFormat.headers,
      });

      console.log(`[WAHA] ${authFormat.name} - Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[WAHA] Resposta sucesso:', JSON.stringify(data));

        // Extrai engine garantindo que seja string
        const rawEngine =
          data?.engine ||
          data?.config?.engine ||
          data?.session?.engine ||
          data?.config?.session?.engine ||
          data?.settings?.engine;

        let engine: string | undefined;
        if (typeof rawEngine === 'string') {
          engine = rawEngine;
        } else if (rawEngine && typeof rawEngine === 'object') {
          engine = rawEngine.name || rawEngine.type || JSON.stringify(rawEngine);
        }

        return {
          success: true,
          status: data.status || 'connected',
          phone:
            data.me?.id?.replace('@c.us', '') ||
            data.me?.pushname ||
            data.config?.webhooks?.[0]?.url,
          engine,
          authFormat: authFormat.name,
        };
      }

      // Se não for 401 (Unauthorized), é outro tipo de erro
      if (response.status !== 401) {
        const errorText = await response.text();
        console.log(`[WAHA] ${authFormat.name} - Erro não-auth:`, errorText);

        try {
          const errorData = JSON.parse(errorText);

          // 404 geralmente significa sessão não encontrada
          if (response.status === 404) {
            return {
              success: false,
              error: `Sessão "${sessionName}" não encontrada. Verifique se a instância existe no WAHA.`,
              authFormat: authFormat.name,
            };
          }

          return {
            success: false,
            error: errorData.message || `Erro ${response.status}: ${errorText}`,
            authFormat: authFormat.name,
          };
        } catch {
          return {
            success: false,
            error: `Erro ${response.status}: ${errorText}`,
            authFormat: authFormat.name,
          };
        }
      }

      console.log(`[WAHA] ${authFormat.name} - Unauthorized, tentando próximo formato...`);
    } catch (error: unknown) {
      console.error(`[WAHA] ${authFormat.name} - Erro de conexão:`, error);
      // Continua tentando outros formatos
    }
  }

  // Nenhum formato funcionou
  return {
    success: false,
    error: 'API Key inválida ou sem permissão. Verifique a API Key configurada no WAHA.',
  };
}

async function testEvolution(
  config: TestConnectionPayload
): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const instanceName = config.instance_name || 'default';

  try {
    console.log('[Evolution] Testando conexão:', { baseUrl, instanceName });

    const endpoint = `/instance/connectionState/${instanceName}`;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        apikey: config.api_key,
      },
    });

    console.log('[Evolution] Status:', response.status);
    const data = await response.json();
    console.log('[Evolution] Resposta:', JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    // Tenta obter info da instância
    let phone = '';
    try {
      const infoResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: { apikey: config.api_key },
      });

      if (infoResponse.ok) {
        const instances = await infoResponse.json();
        const instance = instances.find((i: { name: string }) => i.name === instanceName);
        phone = instance?.ownerJid?.replace('@s.whatsapp.net', '') || '';
      }
    } catch (e) {
      console.log('[Evolution] Erro ao buscar instâncias:', e);
    }

    return {
      success: data.state === 'open',
      status: data.state,
      phone,
      error: data.state !== 'open' ? 'Instância não está conectada' : undefined,
    };
  } catch (error: unknown) {
    console.error('[Evolution] Erro de conexão:', error);
    return {
      success: false,
      error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

async function testZAPI(
  config: TestConnectionPayload
): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);

  try {
    console.log('[Z-API] Testando conexão:', { baseUrl });

    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: {
        'Client-Token': config.api_key,
      },
    });

    console.log('[Z-API] Status:', response.status);
    const data = await response.json();
    console.log('[Z-API] Resposta:', JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return {
      success: data.connected === true,
      status: data.connected ? 'connected' : 'disconnected',
      phone: data.phone,
      error: !data.connected ? 'Instância não está conectada' : undefined,
    };
  } catch (error: unknown) {
    console.error('[Z-API] Erro de conexão:', error);
    return {
      success: false,
      error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

async function testCustom(
  config: TestConnectionPayload
): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);

  try {
    console.log('[Custom] Testando conexão:', { baseUrl });

    // Tenta /health primeiro
    let response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.api_key}`,
      },
    });

    console.log('[Custom] /health Status:', response.status);

    if (!response.ok) {
      // Tenta URL base
      console.log('[Custom] Tentando URL base...');
      response = await fetch(baseUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.api_key}`,
        },
      });

      console.log('[Custom] Base URL Status:', response.status);

      if (!response.ok) {
        return { success: false, error: `Servidor respondeu com status ${response.status}` };
      }
    }

    return { success: true, status: 'connected' };
  } catch (error: unknown) {
    console.error('[Custom] Erro de conexão:', error);
    return {
      success: false,
      error: `Erro de conexão: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: TestConnectionPayload = await req.json();
    console.log('[whatsapp-test-connection] Provider:', payload.provider);
    console.log('[whatsapp-test-connection] Base URL:', payload.base_url);
    console.log('[whatsapp-test-connection] Instance:', payload.instance_name || 'default');

    if (!payload.provider || !payload.base_url || !payload.api_key) {
      return new Response(
        JSON.stringify({ error: 'provider, base_url e api_key são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: {
      success: boolean;
      status?: string;
      phone?: string;
      error?: string;
      authFormat?: string;
    };

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
        result = { success: false, error: 'Provider desconhecido' };
    }

    console.log('[whatsapp-test-connection] Resultado:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[whatsapp-test-connection] Erro:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
