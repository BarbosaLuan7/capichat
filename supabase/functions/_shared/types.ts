/**
 * Tipos compartilhados para Edge Functions do WhatsApp
 *
 * Uso:
 * import { WAHAMessage, WAHAWebhookPayload } from '../_shared/types.ts';
 */

// ============================================
// WAHA (WhatsApp HTTP API) Types
// ============================================

export interface WAHAMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  body: string;
  hasMedia: boolean;
  mediaUrl?: string;
  type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'ptt';
  fromMe: boolean;
  pushName?: string;
  chatId?: string;
  media?: {
    url?: string;
    filename?: string;
    mimetype?: string;
  };
}

export interface WAHAWebhookPayload {
  event: string;
  session: string;
  engine?: string;
  payload: WAHAMessage | Record<string, unknown>;
  me?: {
    id: string;
    pushName: string;
  };
}

// ============================================
// Meta Cloud API Types
// ============================================

export interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256: string; caption?: string };
        audio?: { id: string; mime_type: string };
        video?: { id: string; mime_type: string; caption?: string };
        document?: { id: string; mime_type: string; filename?: string; caption?: string };
      }>;
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

// ============================================
// Phone Types
// ============================================

export interface ParsedPhone {
  countryCode: string;
  localNumber: string;
  fullNumber: string;
  isValid: boolean;
}

export interface PhoneValidation {
  valid: boolean;
  normalized: string;
  error?: string;
  ddd?: string;
  localNumber?: string;
}

// ============================================
// WAHA Config Types
// ============================================

export interface WhatsAppConfig {
  id: string;
  tenant_id: string;
  provider: 'waha' | 'meta';
  session_name: string;
  base_url: string;
  api_key: string;
  phone_number?: string;
  is_active: boolean;
}

// ============================================
// Profile Picture Types
// ============================================

export interface ProfilePictureResult {
  url: string | null;
  reason?: string;
}

// ============================================
// Message Content Types
// ============================================

export interface QuotedMessageData {
  id: string;
  body: string;
  from: string;
  type: string;
}

export interface MessageContentResult {
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  isSystemMessage?: boolean;
  quotedMessage?: QuotedMessageData;
}

// ============================================
// CORS Headers (constante compartilhada)
// ============================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};
