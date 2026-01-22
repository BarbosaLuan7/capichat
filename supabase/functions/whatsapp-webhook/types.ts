import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// Supabase Client Type
// ============================================
export type SupabaseClientType = SupabaseClient;

// ============================================
// Meta Cloud API Types
// ============================================
export interface MetaWebhookEntry {
  id: string;
  changes: {
    field: string;
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: {
        profile: { name: string };
        wa_id: string;
      }[];
      messages?: {
        from: string;
        id: string;
        timestamp: string;
        type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contacts';
        text?: { body: string };
        image?: { id: string; caption?: string };
        audio?: { id: string };
        video?: { id: string; caption?: string };
        document?: { id: string; caption?: string; filename?: string };
      }[];
      statuses?: {
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
      }[];
    };
  }[];
}

// ============================================
// WAHA Config Type
// ============================================
export interface WAHAConfig {
  baseUrl: string;
  apiKey: string;
  sessionName: string;
  instanceId: string;
  tenantId: string | null;
}

// ============================================
// Lead Type
// ============================================
export interface Lead {
  id: string;
  name: string;
  phone: string;
  country_code?: string | null;
  whatsapp_name?: string | null;
  avatar_url?: string | null;
  is_facebook_lid?: boolean;
  original_lid?: string | null;
  assigned_to?: string | null;
  tenant_id?: string | null;
  internal_notes?: string | null;
}

// ============================================
// Conversation Type
// ============================================
export interface Conversation {
  id: string;
  lead_id: string;
  status: 'open' | 'pending' | 'resolved';
  assigned_to?: string | null;
  whatsapp_instance_id?: string | null;
  created_at?: string;
}

// ============================================
// Message Type
// ============================================
export interface Message {
  id: string;
  conversation_id: string;
  lead_id: string;
  sender_id?: string | null;
  sender_type: 'agent' | 'lead' | 'bot';
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact';
  media_url?: string | null;
  direction: 'inbound' | 'outbound';
  source: 'lead' | 'mobile' | 'crm' | 'bot';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  external_id?: string | null;
  waha_message_id?: string | null;
  reply_to_external_id?: string | null;
  quoted_message?: Record<string, unknown> | null;
  created_at?: string;
}

// ============================================
// Webhook Payload Context
// ============================================
export interface WebhookContext {
  provider: 'waha' | 'meta';
  event: string;
  senderPhone: string;
  senderName: string;
  isFromMe: boolean;
  externalMessageId: string;
  isFromFacebookLid: boolean;
  originalLid: string | null;
  wahaMessageId: string | null;
  rawBody: any;
  session: string;
}

// ============================================
// Message Content Result
// ============================================
export interface MessageContentResult {
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact';
  mediaUrl?: string;
  isSystemMessage: boolean;
  quotedMessage?: {
    id: string;
    body?: string;
    type?: string;
    from?: string;
  };
}

// ============================================
// ACK Status Result
// ============================================
export interface AckStatusResult {
  newStatus: 'delivered' | 'read' | null;
  rawMessageId: string | null;
  shortId: string | null;
}

// ============================================
// Constants
// ============================================
export const INVALID_MESSAGE_CONTENTS = [
  '[text]',
  '[Text]',
  '[TEXT]',
  '[media]',
  '[Media]',
  '[MEDIA]',
  '[Mídia]',
];
