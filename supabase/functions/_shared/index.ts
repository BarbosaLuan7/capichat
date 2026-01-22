/**
 * Barrel export para todos os módulos compartilhados
 * Permite imports centralizados: import { normalizePhone, wahaFetch } from '../_shared/index.ts';
 *
 * Ou imports específicos por módulo:
 * import { normalizePhone } from '../_shared/phone.ts';
 * import { wahaFetch } from '../_shared/waha-client.ts';
 */

// ============================================
// Debug (utilitários de log)
// ============================================
export { debug, debugError, debugInfo, debugWarn } from './debug.ts';

// ============================================
// Types (interfaces compartilhadas)
// ============================================
export type {
  WAHAMessage,
  WAHAWebhookPayload,
  MetaWebhookEntry,
  MetaWebhookPayload,
  ParsedPhone,
  PhoneValidation,
  WhatsAppConfig,
  ProfilePictureResult,
  QuotedMessageData,
  MessageContentResult,
} from './types.ts';

export { corsHeaders } from './types.ts';

// ============================================
// URL (normalização)
// ============================================
export { normalizeUrl } from './url.ts';

// ============================================
// Phone (telefone + validação)
// ============================================
export {
  VALID_DDDS,
  COUNTRY_CODES,
  normalizePhone,
  parseInternationalPhone,
  normalizePhoneForStorage,
  formatPhoneForDisplay,
  getPhoneWithCountryCode,
  validateBrazilianPhone,
} from './phone.ts';

// ============================================
// Chat (identificação de chat/grupo/LID)
// ============================================
export {
  isGroupChat,
  isStatusBroadcast,
  isLID,
  buildChatId,
  extractPhoneFromChatId,
} from './chat.ts';

// ============================================
// WAHA Client (cliente HTTP com multi-auth)
// ============================================
export type { WAHAAuthFormat, ContactCheckResult } from './waha-client.ts';
export { wahaFetch, getWahaContactChatId, testWahaConnection } from './waha-client.ts';

// ============================================
// WAHA Config (configuração do banco)
// ============================================
export type { WAHAConfigResult } from './waha-config.ts';
export { getWAHAConfig, getWAHAConfigBySession, getWAHAConfigByTenant } from './waha-config.ts';

// ============================================
// LID (Facebook LIDs)
// ============================================
export { extractRealPhoneFromPayload, resolvePhoneFromLID, formatLID, cleanLID } from './lid.ts';

// ============================================
// Contact (informações de contato)
// ============================================
export {
  getContactInfo,
  getProfilePictureWithReason,
  getProfilePicture,
  getProfilePictureFromLID,
} from './contact.ts';

// ============================================
// Lead Search (busca flexível)
// ============================================
export { findLeadByPhone, findLeadByPhoneAndName } from './lead-search.ts';

// ============================================
// Media (upload para storage)
// ============================================
export type { WAHAMediaConfig, MediaUploadResult } from './media.ts';
export { uploadMediaToStorage, uploadMediaToStorageWithResult } from './media.ts';

// ============================================
// Message Parser (extração de conteúdo)
// ============================================
export { isSystemNotification, getMessageContent } from './message-parser.ts';

// ============================================
// Signature (verificação HMAC)
// ============================================
export { verifyWebhookSignature, generateSignature, generateMetaSignature } from './signature.ts';
