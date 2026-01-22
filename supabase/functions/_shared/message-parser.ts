/**
 * Utilitários para parsing de mensagens do WhatsApp
 * Extração de conteúdo, tipo, mídia e mensagens citadas
 *
 * Uso:
 * import { isSystemNotification, getMessageContent } from '../_shared/message-parser.ts';
 */

import { debug } from './debug.ts';
import type { WAHAMessage, QuotedMessageData, MessageContentResult } from './types.ts';

const PREFIX = 'message-parser';

// ============================================
// Constantes
// ============================================

const SYSTEM_MESSAGE_TYPES = [
  'notification_template',
  'e2e_notification',
  'gp2',
  'ciphertext',
  'protocol',
  'call_log',
  'revoked',
];

const SYSTEM_SUBTYPES = ['contact_info_card', 'url'];

// ============================================
// Detecção de Sistema
// ============================================

/**
 * Verifica se é uma notificação do sistema (não deve ser processada)
 * Ignora mensagens de protocolo, chamadas, criptografia, etc.
 *
 * @param payload - Payload da mensagem WAHA
 * @returns true se for notificação do sistema
 */
export function isSystemNotification(payload: any): boolean {
  const messageType = payload?._data?.type || payload?.type || '';
  const subtype = payload?._data?.subtype || payload?.subtype || '';

  // Verificar se é notificação do sistema
  if (SYSTEM_MESSAGE_TYPES.includes(messageType)) {
    return true;
  }

  // Verificar subtipos que indicam notificações
  if (SYSTEM_SUBTYPES.includes(subtype)) {
    return true;
  }

  return false;
}

// ============================================
// Detecção de Base64
// ============================================

/**
 * Detecta se uma string é conteúdo base64 (mídia inline)
 * Evita exibir dados binários como texto da mensagem
 */
function isBase64Content(str: string): boolean {
  if (!str || str.length < 100) return false;

  // Padrões comuns de início de base64 para diferentes tipos de mídia
  const base64Patterns = [
    '/9j/', // JPEG
    'iVBOR', // PNG
    'R0lGOD', // GIF
    'UklGR', // WEBP
    'AAAA', // Alguns formatos de vídeo/áudio
    'data:image',
    'data:audio',
    'data:video',
  ];

  return (
    base64Patterns.some((pattern) => str.startsWith(pattern)) ||
    (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)))
  );
}

// ============================================
// Detecção de Tipo
// ============================================

type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';

/**
 * Infere tipo de mídia pelo mimetype
 */
function inferTypeFromMimetype(mimetype: string): MessageType | null {
  if (mimetype.startsWith('audio/') || mimetype.includes('ogg')) {
    return 'audio';
  }
  if (mimetype.startsWith('image/')) {
    return 'image';
  }
  if (mimetype.startsWith('video/')) {
    return 'video';
  }
  if (
    mimetype.startsWith('application/') ||
    mimetype.includes('pdf') ||
    mimetype.includes('document')
  ) {
    return 'document';
  }
  return null;
}

/**
 * Infere tipo de mídia pela URL
 */
function inferTypeFromUrl(url: string): MessageType {
  const urlLower = url.toLowerCase();

  if (
    urlLower.includes('ptt') ||
    urlLower.includes('audio') ||
    urlLower.includes('.ogg') ||
    urlLower.includes('.mp3') ||
    urlLower.includes('.m4a')
  ) {
    return 'audio';
  }

  if (
    urlLower.includes('.jpg') ||
    urlLower.includes('.jpeg') ||
    urlLower.includes('.png') ||
    urlLower.includes('.webp')
  ) {
    return 'image';
  }

  if (urlLower.includes('.mp4') || urlLower.includes('.mov') || urlLower.includes('.avi')) {
    return 'video';
  }

  return 'document'; // Default para mídia desconhecida
}

// ============================================
// Extração de Quoted Message
// ============================================

/**
 * Extrai dados da mensagem citada (reply)
 */
function extractQuotedMessage(msg: any): QuotedMessageData | undefined {
  // WAHA pode enviar quotedMsg em diferentes lugares
  const quotedData = msg.quotedMsg || msg._data?.quotedMsg || msg._data?.quotedMsgObj;

  if (!quotedData) return undefined;

  // Extrair ID serializado da mensagem citada
  let quotedId = '';
  if (typeof quotedData.id === 'string') {
    quotedId = quotedData.id;
  } else if (quotedData.id?._serialized) {
    quotedId = quotedData.id._serialized;
  } else if (quotedData.id?.id) {
    // Construir ID serializado manualmente
    const fromMe = quotedData.id.fromMe ? 'true' : 'false';
    const remote = quotedData.id.remote || quotedData.from || '';
    quotedId = `${fromMe}_${remote}_${quotedData.id.id}`;
  }

  // Extrair remetente do quote
  let quotedFrom = quotedData.from || quotedData.participant || '';
  // Limpar sufixo @c.us/@s.whatsapp.net
  quotedFrom = quotedFrom.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');

  // Determinar tipo da mensagem citada
  let quotedType = quotedData.type || 'text';
  if (quotedType === 'chat') quotedType = 'text';
  if (quotedType === 'ptt') quotedType = 'audio';

  const result: QuotedMessageData = {
    id: quotedId,
    body: quotedData.body || quotedData.caption || quotedData.text || `[${quotedType}]`,
    from: quotedFrom,
    type: quotedType,
  };

  debug(PREFIX, 'Quote detectado:', result);
  return result;
}

// ============================================
// Função Principal
// ============================================

/**
 * Extrai conteúdo estruturado de uma mensagem WAHA/Meta
 * Detecta tipo, extrai texto/caption, URL de mídia e quoted messages
 *
 * @param payload - Payload da mensagem (WAHAMessage ou convertido)
 * @param provider - Provedor da mensagem ('waha' ou 'meta')
 * @returns Objeto com content, type, mediaUrl, isSystemMessage e quotedMessage
 */
export function getMessageContent(
  payload: WAHAMessage,
  provider: 'waha' | 'meta'
): MessageContentResult {
  // Para Meta, o payload já vem convertido para WAHAMessage no handler principal
  if (provider === 'waha' || provider === 'meta') {
    const msg = payload as WAHAMessage & { _data?: any };

    // Verificar se é notificação do sistema
    if (isSystemNotification(msg)) {
      return { content: '', type: 'text', isSystemMessage: true };
    }

    // Extrair mediaUrl de múltiplas fontes possíveis no WAHA
    const extractedMediaUrl =
      msg.mediaUrl ||
      msg.media?.url ||
      (msg as any)._data?.media?.url ||
      (msg as any)._data?.deprecatedMms3Url;

    // Extrair mimetype de várias fontes
    const mimetype =
      msg.media?.mimetype ||
      (msg as any)._data?.mimetype ||
      (msg as any)._data?.media?.mimetype ||
      '';

    // Detectar tipo primeiro pelo msg.type, depois pelo _data.type, depois pelo mimetype
    let type: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text';
    const msgType = msg.type || (msg as any)._data?.type || '';

    if (msgType === 'ptt' || msgType === 'audio') {
      type = 'audio';
    } else if (msgType === 'image') {
      type = 'image';
    } else if (msgType === 'video') {
      type = 'video';
    } else if (msgType === 'document') {
      type = 'document';
    } else if (msgType === 'chat' && (msg.hasMedia || extractedMediaUrl)) {
      // msg.type = 'chat' mas tem mídia - inferir pelo mimetype ou URL
      const inferredType = inferTypeFromMimetype(mimetype);
      if (inferredType) {
        type = inferredType;
      } else if (extractedMediaUrl) {
        type = inferTypeFromUrl(extractedMediaUrl);
      }
    }

    debug(
      PREFIX,
      'Detecção de tipo - msg.type:',
      msgType,
      'mimetype:',
      mimetype,
      'hasMedia:',
      msg.hasMedia,
      'type detectado:',
      type,
      'mediaUrl:',
      extractedMediaUrl
    );

    // Tem mídia se hasMedia = true ou se tem URL de mídia
    const hasRealMedia = (msg.hasMedia === true || !!extractedMediaUrl) && type !== 'text';

    // Extrair caption corretamente para mídia
    // Para mensagens de mídia, usar caption em vez de body (que pode conter base64)
    let content = '';

    if (hasRealMedia) {
      // Para mídia: priorizar caption, depois body APENAS se não for base64
      const caption = (msg as any).caption || (msg as any)._data?.caption || '';
      const bodyContent = msg.body || (msg as any)._data?.body || '';

      if (caption && !isBase64Content(caption)) {
        content = caption;
      } else if (bodyContent && !isBase64Content(bodyContent)) {
        content = bodyContent;
      }
      // Se body for base64, content fica vazio (correto)

      debug(
        PREFIX,
        'Mídia detectada - caption:',
        caption?.substring(0, 50),
        'bodyIsBase64:',
        isBase64Content(bodyContent)
      );
    } else {
      // Para mensagens de texto: usar body normalmente
      content = msg.body || (msg as any)._data?.body || (msg as any).text || '';
    }

    // Log de debug se body estiver vazio
    if (!content) {
      debug(
        PREFIX,
        'Body vazio, detalhes:',
        JSON.stringify({
          body: msg.body?.substring(0, 100),
          _data_body: (msg as any)._data?.body?.substring(0, 100),
          text: (msg as any).text,
          caption: (msg as any).caption,
          type: msg.type,
          hasMedia: msg.hasMedia,
        })
      );
    }

    // Placeholder para mídia sem caption
    if (!content && hasRealMedia) {
      // Mídia sem caption - deixar content vazio (não usar placeholder)
      // O frontend vai mostrar a mídia sem texto
      content = '';
    } else if (!content && !hasRealMedia) {
      // Mensagem vazia sem mídia - provavelmente notificação do sistema
      return { content: '', type: 'text', isSystemMessage: true };
    }

    // Extrair quoted message (reply)
    const quotedMessage = extractQuotedMessage(msg);

    return {
      content,
      type,
      mediaUrl: extractedMediaUrl,
      quotedMessage,
    };
  }

  // Fallback para provider desconhecido
  return { content: '', type: 'text', isSystemMessage: true };
}
