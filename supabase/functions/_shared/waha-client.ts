/**
 * Cliente WAHA (WhatsApp HTTP API) para Edge Functions
 * Wrapper com retry multi-auth e utilitários de conexão
 *
 * Uso:
 * import { wahaFetch, getWahaContactChatId } from '../_shared/waha-client.ts';
 */

import { debug, debugError } from './debug.ts';
import { normalizeUrl } from './url.ts';
import { getBrazilianPhoneVariants } from './phone.ts';

const PREFIX = 'waha-client';

// ============================================
// Tipos
// ============================================

export interface WAHAAuthFormat {
  name: string;
  headers: Record<string, string>;
}

export interface ContactCheckResult {
  exists: boolean;
  chatId?: string;
  error?: string;
}

// ============================================
// Cliente Principal
// ============================================

/**
 * Faz request para WAHA tentando múltiplos formatos de autenticação
 * Tenta: X-Api-Key, Bearer token, ApiKey raw
 *
 * @param url - URL completa da API WAHA
 * @param apiKey - Chave de API
 * @param options - Opções do fetch (method, body, etc)
 * @returns Response do fetch
 * @throws Error se todos os formatos falharem
 */
export async function wahaFetch(
  url: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const authFormats: WAHAAuthFormat[] = [
    { name: 'X-Api-Key', headers: { 'X-Api-Key': apiKey } },
    { name: 'Bearer', headers: { Authorization: `Bearer ${apiKey}` } },
    { name: 'ApiKey (sem Bearer)', headers: { Authorization: apiKey } },
  ];

  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (const authFormat of authFormats) {
    try {
      debug(PREFIX, `Tentando ${options.method || 'GET'} ${url} com ${authFormat.name}`);

      const mergedHeaders: Record<string, string> = {
        ...((options.headers as Record<string, string>) || {}),
        ...authFormat.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      debug(PREFIX, `${authFormat.name} - Status: ${response.status}`);

      // Aceita qualquer resposta que não seja 401 (Unauthorized)
      if (response.ok || response.status !== 401) {
        return response;
      }

      lastResponse = response;
      debug(PREFIX, `${authFormat.name} - Unauthorized, tentando próximo...`);
    } catch (error: unknown) {
      debugError(PREFIX, `${authFormat.name} - Erro:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // Retorna última resposta (mesmo com erro) ou lança exceção
  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Todos os formatos de autenticação falharam');
}

/**
 * Verifica se um número existe no WhatsApp e obtém o chatId correto
 * Resolve o problema "No LID for user" para números novos
 *
 * @param baseUrl - URL base do WAHA (sem trailing slash)
 * @param apiKey - Chave de API
 * @param session - Nome da sessão
 * @param phone - Número de telefone (pode ter ou não código do país)
 * @returns Objeto com exists, chatId e possível erro
 */
export async function getWahaContactChatId(
  baseUrl: string,
  apiKey: string,
  session: string,
  phone: string
): Promise<ContactCheckResult> {
  try {
    // Remove o + se existir e garante formato limpo
    const cleanPhone = phone.replace(/^\+/, '').replace(/\D/g, '');
    const normalizedBaseUrl = normalizeUrl(baseUrl);

    // Gera variantes do número brasileiro (com/sem nono dígito)
    const phoneVariants = getBrazilianPhoneVariants(cleanPhone);
    debug(PREFIX, `Variantes do número ${cleanPhone}:`, phoneVariants);

    // Tenta cada variante até encontrar uma que existe no WhatsApp
    for (const variant of phoneVariants) {
      const url = `${normalizedBaseUrl}/api/contacts/check-exists?phone=${variant}&session=${session}`;
      debug(PREFIX, `Verificando variante ${variant}:`, url);

      const response = await wahaFetch(url, apiKey, { method: 'GET' });
      const responseText = await response.text();
      debug(PREFIX, `check-exists ${variant} resposta:`, response.status, responseText);

      if (!response.ok) {
        debug(
          PREFIX,
          `Variante ${variant} falhou com status ${response.status}, tentando próxima...`
        );
        continue;
      }

      const data = JSON.parse(responseText);

      // Resposta pode ter diferentes formatos dependendo da versão do WAHA
      const exists = data.numberExists || data.exists || data.isRegistered || false;

      if (exists) {
        const chatId = data.chatId || data.jid || data.id || `${variant}@c.us`;
        debug(PREFIX, `Encontrado! Variante ${variant} existe no WhatsApp, chatId: ${chatId}`);
        return {
          exists: true,
          chatId,
        };
      }

      debug(PREFIX, `Variante ${variant} não existe no WhatsApp, tentando próxima...`);
    }

    // Nenhuma variante encontrada - retorna o número original como fallback
    debug(PREFIX, `Nenhuma variante encontrada para ${cleanPhone}, usando original`);
    return {
      exists: false,
      chatId: `${cleanPhone}@c.us`,
      error: 'Número não encontrado no WhatsApp (tentadas todas as variantes brasileiras)',
    };
  } catch (error) {
    debugError(PREFIX, 'Erro ao verificar existência do número:', error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Testa conexão com WAHA API
 *
 * @param baseUrl - URL base do WAHA
 * @param apiKey - Chave de API
 * @param session - Nome da sessão (opcional)
 * @returns Objeto com status da conexão
 */
export async function testWahaConnection(
  baseUrl: string,
  apiKey: string,
  session?: string
): Promise<{ connected: boolean; status?: string; phone?: string; error?: string }> {
  try {
    const normalizedBaseUrl = normalizeUrl(baseUrl);
    const url = session
      ? `${normalizedBaseUrl}/api/sessions/${session}/me`
      : `${normalizedBaseUrl}/api/sessions`;

    const response = await wahaFetch(url, apiKey, { method: 'GET' });
    const responseText = await response.text();

    if (!response.ok) {
      return {
        connected: false,
        error: `API retornou ${response.status}: ${responseText}`,
      };
    }

    const data = JSON.parse(responseText);

    // Extrair informações relevantes
    if (session) {
      return {
        connected: true,
        status: data.status || 'connected',
        phone: data.pushname || data.me?.id?.replace('@c.us', ''),
      };
    }

    return {
      connected: true,
      status: 'sessions available',
    };
  } catch (error) {
    debugError(PREFIX, 'Erro ao testar conexão:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
