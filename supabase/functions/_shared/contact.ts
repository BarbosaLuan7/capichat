/**
 * Utilitários para operações de contato via WAHA API
 * Inclui busca de informações e foto de perfil
 *
 * Uso:
 * import { getContactInfo, getProfilePicture } from '../_shared/contact.ts';
 */

import { debug, debugError, debugInfo } from './debug.ts';
import { wahaFetch } from './waha-client.ts';
import { normalizeUrl } from './url.ts';
import type { ProfilePictureResult } from './types.ts';

const PREFIX = 'contact';

// ============================================
// Informações do Contato
// ============================================

/**
 * Busca informações do contato via WAHA API
 * Retorna nome salvo nos contatos e pushname (nome definido pelo usuário)
 *
 * @param wahaBaseUrl - URL base do WAHA
 * @param apiKey - Chave de API
 * @param sessionName - Nome da sessão
 * @param contactId - ID do contato (número com ou sem @c.us)
 * @param timeout - Timeout em ms (default: 5000)
 * @returns Objeto com name e pushname
 */
export async function getContactInfo(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  contactId: string,
  timeout: number = 5000
): Promise<{ name: string | null; pushname: string | null }> {
  try {
    // Usar apenas o número SEM @c.us
    const cleanNumber = contactId
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')
      .replace(/\D/g, '');

    const normalizedBaseUrl = normalizeUrl(wahaBaseUrl);
    const url = `${normalizedBaseUrl}/api/contacts?contactId=${cleanNumber}&session=${sessionName}`;

    debug(PREFIX, '📇 Buscando info do contato:', cleanNumber);

    // Usar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await wahaFetch(url, apiKey, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      debug(PREFIX, '📇 API contato retornou status:', response.status);
      return { name: null, pushname: null };
    }

    const data = await response.json();
    debug(PREFIX, '📇 Resposta info contato:', JSON.stringify(data).slice(0, 300));

    // A resposta pode ter diferentes formatos
    const name = data?.name || data?.verifiedName || null;
    const pushname = data?.pushname || data?.pushName || data?.notify || null;

    if (name || pushname) {
      debug(PREFIX, '📇 Info encontrada - name:', name, '| pushname:', pushname);
    } else {
      debug(PREFIX, '📇 Nenhum nome encontrado para:', cleanNumber);
    }

    return { name, pushname };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      debug(PREFIX, '📇 Timeout ao buscar info do contato');
    } else {
      debugError(PREFIX, '📇 Erro ao buscar info do contato:', error);
    }
    return { name: null, pushname: null };
  }
}

// ============================================
// Foto de Perfil
// ============================================

/**
 * Busca foto de perfil do WhatsApp via WAHA API
 * Suporta tanto números normais quanto LIDs do Facebook
 * Retorna URL e motivo de falha
 *
 * @param wahaBaseUrl - URL base do WAHA
 * @param apiKey - Chave de API
 * @param sessionName - Nome da sessão
 * @param contactId - ID do contato
 * @param isLid - Se é um LID do Facebook (default: false)
 * @param timeout - Timeout em ms (default: 8000)
 * @returns Objeto com url e reason (motivo de falha)
 */
export async function getProfilePictureWithReason(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  contactId: string,
  isLid: boolean = false,
  timeout: number = 8000
): Promise<ProfilePictureResult> {
  try {
    let formattedContactId: string;
    const normalizedBaseUrl = normalizeUrl(wahaBaseUrl);

    if (isLid) {
      // Para LIDs: garantir que tem @lid no final
      const cleanLid = contactId.replace('@lid', '').replace(/\D/g, '');
      formattedContactId = `${cleanLid}@lid`;
      debug(PREFIX, '📷 Buscando foto via LID:', formattedContactId);
    } else {
      // Para números normais: limpar e adicionar @c.us (formato exigido pela WAHA)
      const cleanPhone = contactId
        .replace('@c.us', '')
        .replace('@s.whatsapp.net', '')
        .replace(/\D/g, '');

      // Ignorar números muito curtos ou inválidos
      if (cleanPhone.length < 10) {
        debug(PREFIX, '📷 Número muito curto para buscar foto:', cleanPhone);
        return { url: null, reason: 'number_too_short' };
      }
      formattedContactId = `${cleanPhone}@c.us`;
      debug(PREFIX, '📷 Buscando foto via telefone:', formattedContactId);
    }

    // Adicionar refresh=true para forçar buscar do WhatsApp (evita cache vazio de 24h)
    const url = `${normalizedBaseUrl}/api/contacts/profile-picture?contactId=${formattedContactId}&session=${sessionName}&refresh=true`;

    debug(PREFIX, '📷 Request URL:', url);

    // Usar AbortController para timeout (fotos podem demorar mais)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await wahaFetch(url, apiKey, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      debug(
        PREFIX,
        '📷 API foto de perfil retornou status:',
        response.status,
        errorText.substring(0, 100)
      );
      return { url: null, reason: `api_error_${response.status}` };
    }

    const data = await response.json();
    debug(PREFIX, '📷 Resposta API foto:', JSON.stringify(data).substring(0, 200));

    // A resposta pode ter diferentes formatos
    const profilePictureUrl =
      data?.profilePictureURL || data?.profilePicture || data?.url || data?.imgUrl;

    if (
      profilePictureUrl &&
      typeof profilePictureUrl === 'string' &&
      profilePictureUrl.startsWith('http')
    ) {
      debugInfo(PREFIX, '📷 Foto de perfil encontrada!');
      return { url: profilePictureUrl };
    }

    debug(PREFIX, '📷 Foto não encontrada ou privada');
    return { url: null, reason: 'no_picture_or_private' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      debug(PREFIX, '📷 Timeout ao buscar foto de perfil');
      return { url: null, reason: 'timeout' };
    } else {
      debugError(PREFIX, '📷 Erro ao buscar foto de perfil:', error);
      return { url: null, reason: error instanceof Error ? error.message : 'unknown_error' };
    }
  }
}

/**
 * Busca foto de perfil (versão simplificada)
 * Wrapper que retorna apenas a URL
 *
 * @param wahaBaseUrl - URL base do WAHA
 * @param apiKey - Chave de API
 * @param sessionName - Nome da sessão
 * @param contactId - ID do contato
 * @returns URL da foto ou null
 */
export async function getProfilePicture(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  contactId: string
): Promise<string | null> {
  const result = await getProfilePictureWithReason(wahaBaseUrl, apiKey, sessionName, contactId);
  return result.url;
}

/**
 * Busca foto de perfil de um LID
 * Wrapper conveniente para LIDs
 *
 * @param wahaBaseUrl - URL base do WAHA
 * @param apiKey - Chave de API
 * @param sessionName - Nome da sessão
 * @param lid - LID do Facebook
 * @returns URL da foto ou null
 */
export async function getProfilePictureFromLID(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  lid: string
): Promise<string | null> {
  const result = await getProfilePictureWithReason(
    wahaBaseUrl,
    apiKey,
    sessionName,
    lid,
    true // isLid = true
  );
  return result.url;
}
