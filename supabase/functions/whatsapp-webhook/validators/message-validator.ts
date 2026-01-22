import { INVALID_MESSAGE_CONTENTS } from '../types.ts';

/**
 * Validate message content
 * Returns validation result with reason if invalid
 */
export function validateMessageContent(
  content: string,
  mediaUrl?: string
): { isValid: boolean; reason?: string } {
  // Empty message without media
  if (!content && !mediaUrl) {
    console.log('[message-validator] Ignoring message without content and without media');
    return { isValid: false, reason: 'empty_message' };
  }

  // Invalid placeholder content
  if (content && INVALID_MESSAGE_CONTENTS.includes(content)) {
    console.log('[message-validator] Ignoring message with invalid placeholder:', content);
    return { isValid: false, reason: 'placeholder_content' };
  }

  return { isValid: true };
}

/**
 * Check if content is a placeholder that should be ignored
 */
export function isPlaceholderContent(content: string): boolean {
  return INVALID_MESSAGE_CONTENTS.includes(content);
}

/**
 * Check if message has valid content or media
 */
export function hasValidContent(content: string, mediaUrl?: string): boolean {
  if (mediaUrl) return true;
  if (!content) return false;
  return !isPlaceholderContent(content);
}

/**
 * Sanitize message content
 * Removes problematic characters and normalizes whitespace
 */
export function sanitizeContent(content: string): string {
  if (!content) return '';

  // Remove null characters using string split/join to avoid regex control char lint error
  const withoutNulls = content.split(String.fromCharCode(0)).join('');

  return withoutNulls
    .trim()
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n');
}

/**
 * Truncate content to maximum length
 */
export function truncateContent(content: string, maxLength: number = 10000): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;

  return content.substring(0, maxLength) + '...';
}

/**
 * Validate message type
 */
export function validateMessageType(type: string): { isValid: boolean; normalizedType: string } {
  const validTypes = [
    'text',
    'image',
    'audio',
    'video',
    'document',
    'sticker',
    'location',
    'contact',
    'chat',
    'ptt',
  ];

  const lowerType = type.toLowerCase();

  if (validTypes.includes(lowerType)) {
    // Normalize chat to text and ptt to audio
    let normalizedType = lowerType;
    if (normalizedType === 'chat') normalizedType = 'text';
    if (normalizedType === 'ptt') normalizedType = 'audio';

    return { isValid: true, normalizedType };
  }

  console.warn('[message-validator] Unknown message type:', type, '- defaulting to text');
  return { isValid: true, normalizedType: 'text' };
}

/**
 * Check if message is a poll/reaction/other unsupported type
 */
export function isUnsupportedMessageType(type: string): boolean {
  const unsupportedTypes = [
    'poll',
    'poll_creation',
    'reaction',
    'product',
    'product_list',
    'order',
  ];
  return unsupportedTypes.includes(type.toLowerCase());
}

/**
 * Extract display content for message preview
 * Used for generating previews/notifications
 */
export function getPreviewContent(content: string, type: string, maxLength: number = 50): string {
  if (type !== 'text' && type !== 'chat') {
    const typeLabels: Record<string, string> = {
      image: 'Imagem',
      audio: 'Audio',
      video: 'Video',
      document: 'Documento',
      sticker: 'Sticker',
      location: 'Localizacao',
      contact: 'Contato',
      ptt: 'Audio',
    };

    const label = typeLabels[type] || type;

    if (content) {
      return `[${label}] ${content.substring(0, maxLength - label.length - 3)}`;
    }
    return `[${label}]`;
  }

  if (!content) return '';
  if (content.length <= maxLength) return content;

  return content.substring(0, maxLength - 3) + '...';
}
