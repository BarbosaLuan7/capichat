/**
 * Utilitários para resolução de Facebook LIDs (números privados de anúncios)
 *
 * Uso:
 * import { extractRealPhoneFromPayload, resolvePhoneFromLID } from '../_shared/lid.ts';
 */

import { debug, debugError, debugInfo } from './debug.ts';
import { wahaFetch } from './waha-client.ts';
import { normalizeUrl } from './url.ts';

const PREFIX = 'lid';

// ============================================
// Extração de Payload
// ============================================

/**
 * Extrai o número real do payload WAHA quando é um LID
 * Tenta diferentes caminhos no payload para encontrar o número real
 *
 * @param payload - Payload do webhook WAHA
 * @returns Número real ou null se não encontrar
 */
export function extractRealPhoneFromPayload(payload: any): string | null {
  const possiblePaths = [
    payload?._data?.from?._serialized,
    payload?._data?.chat?.id?._serialized,
    payload?.chat?.id,
    payload?._data?.chatId,
    payload?._data?.from,
  ];

  for (const path of possiblePaths) {
    if (path && typeof path === 'string') {
      // Se termina com @c.us ou @s.whatsapp.net, é um número real
      if (path.includes('@c.us') || path.includes('@s.whatsapp.net')) {
        debug(PREFIX, 'Número real encontrado no payload:', path);
        return path;
      }
      // Se é um número com 10-13 dígitos (sem @lid), provavelmente é real
      const digits = path.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 13 && !path.includes('@lid')) {
        debug(PREFIX, 'Número real (dígitos) encontrado no payload:', digits);
        return digits;
      }
    }
  }

  return null;
}

// ============================================
// Resolução via API
// ============================================

/**
 * Resolve LID para número real usando API do WAHA
 * A resposta pode ter diferentes formatos: pn, phone, number, jid, id
 *
 * @param wahaBaseUrl - URL base do WAHA
 * @param apiKey - Chave de API
 * @param sessionName - Nome da sessão
 * @param lid - LID a ser resolvido (com ou sem @lid)
 * @returns Número real ou null se não conseguir resolver
 */
export async function resolvePhoneFromLID(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  lid: string
): Promise<string | null> {
  try {
    // Limpar o LID para obter apenas o número
    const cleanLid = lid.replace('@lid', '').replace(/\D/g, '');
    const normalizedBaseUrl = normalizeUrl(wahaBaseUrl);

    // URL da API WAHA para resolver LID
    const url = `${normalizedBaseUrl}/api/${sessionName}/lids/${cleanLid}`;

    debugInfo(PREFIX, 'Tentando resolver LID via WAHA API:', url);

    const response = await wahaFetch(url, apiKey, { method: 'GET' });

    if (!response.ok) {
      const errorText = await response.text();
      debug(PREFIX, 'API WAHA retornou:', response.status, errorText.substring(0, 100));
      return null;
    }

    const data = await response.json();
    debug(PREFIX, 'Resposta da API LID:', JSON.stringify(data).substring(0, 200));

    // A resposta do WAHA pode ter diferentes formatos - campo 'pn' é o mais comum
    const realPhone =
      data?.pn?.replace('@c.us', '') ||
      data?.phone ||
      data?.number ||
      data?.jid?.replace('@c.us', '') ||
      data?.id?.replace('@c.us', '');

    if (realPhone && !realPhone.includes('lid')) {
      debugInfo(PREFIX, '✅ Número real encontrado via API:', realPhone);
      return realPhone;
    }

    debug(PREFIX, 'Não foi possível extrair número real da resposta');
    return null;
  } catch (error) {
    debugError(PREFIX, 'Erro ao resolver LID via API:', error);
    return null;
  }
}

/**
 * Formata LID para o formato esperado pela API (@lid)
 *
 * @param lid - LID em qualquer formato
 * @returns LID formatado com @lid
 */
export function formatLID(lid: string): string {
  const cleanLid = lid.replace('@lid', '').replace(/\D/g, '');
  return `${cleanLid}@lid`;
}

/**
 * Extrai apenas os dígitos de um LID
 *
 * @param lid - LID em qualquer formato
 * @returns Apenas os dígitos
 */
export function cleanLID(lid: string): string {
  return lid.replace('@lid', '').replace(/\D/g, '');
}
