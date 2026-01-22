import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { normalizeUrl } from '../_shared/url.ts';

interface TestConnectionPayload {
  provider: 'waha' | 'meta';
  base_url: string;
  api_key: string;
  instance_name?: string;
  phone_number_id?: string;
}

// Tenta WAHA com múltiplos formatos de autenticação
async function testWAHA(config: TestConnectionPayload): Promise<{
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

// ========== TESTE VIA META CLOUD API ==========
async function testMeta(
  config: TestConnectionPayload
): Promise<{ success: boolean; status?: string; phone?: string; error?: string }> {
  const phoneNumberId = config.phone_number_id;
  const accessToken = config.api_key;

  if (!phoneNumberId) {
    return { success: false, error: 'Meta Cloud API: phone_number_id não configurado' };
  }

  try {
    console.log('[Meta] Testando conexão para phone_number_id:', phoneNumberId);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=verified_name,display_phone_number`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('[Meta] Status:', response.status);
    const data = await response.json();
    console.log('[Meta] Resposta:', JSON.stringify(data));

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `Erro ${response.status}`,
      };
    }

    return {
      success: true,
      status: 'connected',
      phone: data.display_phone_number || data.verified_name,
    };
  } catch (error: unknown) {
    console.error('[Meta] Erro de conexão:', error);
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
      case 'meta':
        result = await testMeta(payload);
        break;
      default:
        result = {
          success: false,
          error: `Provider não suportado: ${payload.provider}. Use 'waha' ou 'meta'.`,
        };
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
