/**
 * Utilitários para upload de mídia para Supabase Storage
 * Download de arquivos do WAHA e armazenamento persistente
 *
 * Uso:
 * import { uploadMediaToStorage } from '../_shared/media.ts';
 */

import { debug, debugError, debugInfo } from './debug.ts';

const PREFIX = 'media';

// ============================================
// Tipos
// ============================================

export interface WAHAMediaConfig {
  baseUrl: string;
  apiKey: string;
  sessionName: string;
}

export interface MediaUploadResult {
  storageRef: string | null;
  error?: string;
}

// ============================================
// Mapa de Extensões
// ============================================

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const TYPE_FALLBACK_EXTENSIONS: Record<string, string> = {
  image: 'jpg',
  audio: 'ogg',
  video: 'mp4',
  document: 'bin',
};

// ============================================
// Funções Auxiliares
// ============================================

/**
 * Normaliza URL adicionando protocolo se necessário
 */
function normalizeMediaUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Corrige URLs localhost para usar base_url do WAHA
 */
function correctLocalhostUrl(url: string, wahaBaseUrl: string): string {
  const urlObj = new URL(url);
  const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';

  if (isLocalhost && wahaBaseUrl) {
    const wahaUrlObj = new URL(wahaBaseUrl);
    return `${wahaUrlObj.protocol}//${wahaUrlObj.host}${urlObj.pathname}${urlObj.search}`;
  }

  return url;
}

/**
 * Determina extensão do arquivo baseado no content-type ou tipo
 */
function getFileExtension(contentType: string, messageType: string): string {
  // Tentar match exato
  let extension = CONTENT_TYPE_EXTENSIONS[contentType];

  if (!extension) {
    // Tentar match parcial
    for (const [ct, ext] of Object.entries(CONTENT_TYPE_EXTENSIONS)) {
      if (contentType.includes(ct.split('/')[1])) {
        extension = ext;
        break;
      }
    }
  }

  // Fallback baseado no tipo de mensagem
  if (!extension) {
    extension = TYPE_FALLBACK_EXTENSIONS[messageType] || 'bin';
  }

  return extension;
}

// ============================================
// Função Principal
// ============================================

/**
 * Baixa mídia de URL e faz upload para o Supabase Storage
 * Suporta URLs do WAHA com autenticação automática
 * Corrige URLs localhost para produção
 *
 * @param supabase - Cliente Supabase
 * @param mediaUrl - URL da mídia para baixar
 * @param type - Tipo da mídia (image, audio, video, document)
 * @param leadId - ID do lead para organizar arquivos
 * @param wahaConfig - Configuração WAHA para autenticação (opcional)
 * @returns Storage reference ou null em caso de erro
 */
export async function uploadMediaToStorage(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string,
  wahaConfig?: WAHAMediaConfig | null
): Promise<string | null> {
  try {
    // Normalizar URL - adicionar https:// se não tiver protocolo
    let normalizedUrl = normalizeMediaUrl(mediaUrl);
    if (normalizedUrl !== mediaUrl) {
      debug(PREFIX, 'URL normalizada (protocolo adicionado):', mediaUrl, '->', normalizedUrl);
    }

    // Corrigir URL localhost para usar base_url do WAHA
    let correctedUrl = normalizedUrl;
    if (wahaConfig?.baseUrl) {
      correctedUrl = correctLocalhostUrl(normalizedUrl, wahaConfig.baseUrl);
      if (correctedUrl !== normalizedUrl) {
        debug(PREFIX, 'URL localhost corrigida:', mediaUrl, '->', correctedUrl);
      }
    }

    debug(PREFIX, 'Baixando mídia de:', correctedUrl);

    // Preparar headers de autenticação se for URL do WAHA
    const headers: Record<string, string> = {};
    const isWahaUrl =
      wahaConfig?.baseUrl && correctedUrl.includes(new URL(wahaConfig.baseUrl).host);

    if (isWahaUrl && wahaConfig?.apiKey) {
      headers['X-Api-Key'] = wahaConfig.apiKey;
      headers['Authorization'] = `Bearer ${wahaConfig.apiKey}`;
      debug(PREFIX, 'Adicionando headers de autenticação para WAHA');
    }

    // Baixar o arquivo
    const response = await fetch(correctedUrl, { headers });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      debugError(PREFIX, 'Erro ao baixar mídia:', response.status, errorText.substring(0, 100));
      return null;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();

    debug(PREFIX, 'Mídia baixada, contentType:', contentType, 'size:', arrayBuffer.byteLength);

    // Determinar extensão
    const extension = getFileExtension(contentType, type);

    // Nome do arquivo: leads/{leadId}/{timestamp}.{ext}
    const fileName = `leads/${leadId}/${Date.now()}.${extension}`;

    // Upload para o storage
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, arrayBuffer, {
        contentType,
        cacheControl: '31536000', // 1 ano
        upsert: false,
      });

    if (error) {
      debugError(PREFIX, 'Erro no upload:', error);
      return null;
    }

    // Retornar storage ref em vez de publicUrl (bucket é privado)
    // Frontend vai gerar signed URL quando precisar exibir
    const storageRef = `storage://message-attachments/${data.path}`;
    debugInfo(PREFIX, '✅ Mídia salva em storage:', storageRef);
    return storageRef;
  } catch (error) {
    debugError(PREFIX, 'Erro ao processar mídia:', error);
    return null;
  }
}

/**
 * Versão com resultado estruturado
 */
export async function uploadMediaToStorageWithResult(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string,
  wahaConfig?: WAHAMediaConfig | null
): Promise<MediaUploadResult> {
  const storageRef = await uploadMediaToStorage(supabase, mediaUrl, type, leadId, wahaConfig);
  return {
    storageRef,
    error: storageRef ? undefined : 'Failed to upload media',
  };
}
