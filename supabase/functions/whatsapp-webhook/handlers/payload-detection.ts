import { WAHAMessage, normalizePhone, getMessageContent } from '../../_shared/index.ts';
import type { SupabaseClientType, MetaWebhookEntry } from '../types.ts';
import { createSuccessResponse, createIgnoredResponse, createErrorResponse } from './auth.ts';

/**
 * Detect provider and event type from webhook payload
 */
export function detectProvider(body: any): {
  provider: 'waha' | 'meta' | 'unknown';
  event: string;
} {
  // WAHA format
  if (body.event && body.session !== undefined) {
    return { provider: 'waha', event: body.event };
  }

  // Meta Cloud API format
  if (body.object === 'whatsapp_business_account' && body.entry) {
    return { provider: 'meta', event: 'webhook' };
  }

  return { provider: 'unknown', event: '' };
}

/**
 * Check if payload is a WAHA ACK event
 */
export function isWAHAAckEvent(event: string): boolean {
  return event === 'message.ack';
}

/**
 * Check if payload is a WAHA message event
 */
export function isWAHAMessageEvent(event: string): boolean {
  return event === 'message' || event === 'message.any';
}

/**
 * Handle Meta webhook status updates
 */
export async function handleMetaStatusUpdates(
  supabase: SupabaseClientType,
  statuses: MetaWebhookEntry['changes'][0]['value']['statuses']
): Promise<Response | null> {
  if (!statuses || statuses.length === 0) return null;

  for (const statusUpdate of statuses) {
    const messageId = statusUpdate.id;
    const status = statusUpdate.status;

    console.log('[payload-detection] Meta status update:', { messageId, status });

    let newStatus: 'delivered' | 'read' | null = null;
    if (status === 'delivered') {
      newStatus = 'delivered';
    } else if (status === 'read') {
      newStatus = 'read';
    }

    if (newStatus && messageId) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: newStatus })
        .eq('external_id', messageId);

      if (updateError) {
        console.error('[payload-detection] Error updating Meta status:', updateError);
      } else {
        console.log('[payload-detection] Meta status updated:', newStatus, 'messageId:', messageId);
      }
    }
  }

  return createSuccessResponse({ success: true, event: 'status_update', provider: 'meta' });
}

/**
 * Extract message data from Meta webhook
 */
export function extractMetaMessageData(entry: MetaWebhookEntry): {
  messageData: WAHAMessage | null;
  senderPhone: string;
  senderName: string;
  externalMessageId: string;
} | null {
  for (const change of entry.changes) {
    if (change.field !== 'messages') continue;

    const value = change.value;

    if (value.messages && value.messages.length > 0) {
      const metaMsg = value.messages[0];
      const contact = value.contacts?.[0];

      const senderPhone = normalizePhone(metaMsg.from);
      const senderName = contact?.profile?.name || '';
      const externalMessageId = metaMsg.id;

      // Convert to WAHAMessage format for compatibility
      let msgBody = '';
      let msgType: 'chat' | 'image' | 'audio' | 'video' | 'document' | 'ptt' = 'chat';

      if (metaMsg.type === 'text' && metaMsg.text) {
        msgBody = metaMsg.text.body;
        msgType = 'chat';
      } else if (metaMsg.type === 'image' && metaMsg.image) {
        msgBody = metaMsg.image.caption || '';
        msgType = 'image';
      } else if (metaMsg.type === 'audio' && metaMsg.audio) {
        msgType = 'audio';
      } else if (metaMsg.type === 'video' && metaMsg.video) {
        msgBody = metaMsg.video.caption || '';
        msgType = 'video';
      } else if (metaMsg.type === 'document' && metaMsg.document) {
        msgBody = metaMsg.document.caption || '';
        msgType = 'document';
      }

      const messageData: WAHAMessage = {
        id: metaMsg.id,
        timestamp: parseInt(metaMsg.timestamp),
        from: metaMsg.from,
        to: value.metadata.phone_number_id,
        body: msgBody,
        hasMedia: ['image', 'audio', 'video', 'document'].includes(metaMsg.type),
        type: msgType,
        fromMe: false, // Meta webhook only receives inbound messages
        pushName: senderName,
      };

      console.log('[payload-detection] Meta message received:', {
        from: senderPhone,
        name: senderName,
        type: msgType,
      });

      return { messageData, senderPhone, senderName, externalMessageId };
    }
  }

  return null;
}

/**
 * Process Meta webhook entries
 */
export async function processMetaWebhook(
  supabase: SupabaseClientType,
  entries: MetaWebhookEntry[]
): Promise<{
  messageData: WAHAMessage | null;
  senderPhone: string;
  senderName: string;
  externalMessageId: string;
  statusResponse: Response | null;
}> {
  for (const entry of entries) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;

      // Handle status updates first
      if (value.statuses && value.statuses.length > 0) {
        const statusResponse = await handleMetaStatusUpdates(supabase, value.statuses);
        return {
          messageData: null,
          senderPhone: '',
          senderName: '',
          externalMessageId: '',
          statusResponse,
        };
      }

      // Extract message data
      const messageInfo = extractMetaMessageData(entry);
      if (messageInfo) {
        return {
          ...messageInfo,
          statusResponse: null,
        };
      }
    }
  }

  return {
    messageData: null,
    senderPhone: '',
    senderName: '',
    externalMessageId: '',
    statusResponse: null,
  };
}
