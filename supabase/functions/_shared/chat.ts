/**
 * Utilitários de detecção de tipo de chat do WhatsApp
 *
 * Uso:
 * import { isGroupChat, isStatusBroadcast, isLID } from '../_shared/chat.ts';
 */

/**
 * Detecta se é um chat de grupo
 * IDs de grupo terminam com @g.us ou começam com 120363
 */
export function isGroupChat(chatId: string): boolean {
  if (!chatId) return false;
  return chatId.includes('@g.us') || chatId.includes('g.us') || chatId.startsWith('120363');
}

/**
 * Detecta se é um broadcast/status (stories do WhatsApp)
 * Deve ser ignorado no processamento
 */
export function isStatusBroadcast(chatId: string): boolean {
  if (!chatId) return false;
  return (
    chatId.includes('status@broadcast') ||
    chatId === 'status@broadcast' ||
    chatId.includes('@broadcast')
  );
}

/**
 * Detecta se é um LID do Facebook (número privado de anúncios)
 * Formatos conhecidos:
 * - "174621106159626@lid"
 * - Números com 15+ dígitos sem @c.us/@s.whatsapp.net
 */
export function isLID(phone: string): boolean {
  if (!phone) return false;
  const cleanPhone = phone.replace(/\D/g, '');
  return (
    phone.includes('@lid') ||
    phone.endsWith('@lid') ||
    (cleanPhone.length >= 15 && !phone.includes('@c.us') && !phone.includes('@s.whatsapp.net'))
  );
}

/**
 * Constrói o chatId no formato do WhatsApp
 * Adiciona @c.us se necessário
 */
export function buildChatId(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.includes('@')) return cleanPhone;
  return `${cleanPhone}@c.us`;
}

/**
 * Extrai o número de telefone de um chatId
 * Remove sufixos @c.us, @s.whatsapp.net, @lid, @g.us
 */
export function extractPhoneFromChatId(chatId: string): string {
  return chatId
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace('@g.us', '')
    .replace(/\D/g, '');
}
