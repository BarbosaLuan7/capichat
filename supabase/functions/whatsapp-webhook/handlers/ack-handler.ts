import {
  normalizePhone,
  isLID,
  getWAHAConfigBySession,
  resolvePhoneFromLID,
  findLeadByPhone,
} from '../../_shared/index.ts';
import type { SupabaseClientType, AckStatusResult } from '../types.ts';
import { createSuccessResponse, createIgnoredResponse } from './auth.ts';
import { isSelfMessage } from '../validators/filter-validator.ts';
import { findLeadByLid, getInstancePhoneNumber } from '../processors/lead-processor.ts';
import { findOrCreateConversation } from '../processors/conversation-processor.ts';

/**
 * Parse ACK status from payload
 */
export function parseAckStatus(payload: any): AckStatusResult {
  const rawMessageId = payload.id || payload.key?.id || payload.ids?.[0];
  const ackName = payload.ackName || payload.receipt_type || payload.ack;
  const ackNumber = payload.ack;

  console.log('[ack-handler] ACK received:', {
    messageId: rawMessageId,
    ackName,
    ackNumber,
  });

  let newStatus: 'delivered' | 'read' | null = null;

  // WAHA uses ackName: 'DEVICE' (delivered), 'READ' (read), 'PLAYED' (audio played)
  // Or ack: 2 (delivered), 3 (read)
  if (['DEVICE', 'delivered', 'DELIVERY_ACK'].includes(ackName) || ackNumber === 2) {
    newStatus = 'delivered';
  } else if (['READ', 'read', 'PLAYED'].includes(ackName) || ackNumber === 3) {
    newStatus = 'read';
  }

  // Extract short ID if serialized format
  let shortId: string | null = null;
  if (typeof rawMessageId === 'string' && rawMessageId.includes('_')) {
    const parts = rawMessageId.split('_');
    shortId = parts[parts.length - 1];
  }

  console.log('[ack-handler] IDs for search:', { rawMessageId, shortId });

  return { newStatus, rawMessageId, shortId };
}

/**
 * Update message status by external_id
 */
async function updateMessageStatusByIds(
  supabase: SupabaseClientType,
  rawMessageId: string,
  shortId: string | null,
  newStatus: 'delivered' | 'read'
): Promise<boolean> {
  // Try short ID first (new format)
  if (shortId) {
    const { data: shortMatch, error: shortError } = await supabase
      .from('messages')
      .update({ status: newStatus })
      .eq('external_id', shortId)
      .select('id');

    if (!shortError && shortMatch && shortMatch.length > 0) {
      console.log('[ack-handler] Status updated (shortId match):', newStatus, 'shortId:', shortId);
      return true;
    }
  }

  // Try exact match (serialized ID)
  const { data: exactMatch, error: exactError } = await supabase
    .from('messages')
    .update({ status: newStatus })
    .eq('external_id', rawMessageId)
    .select('id');

  if (!exactError && exactMatch && exactMatch.length > 0) {
    console.log(
      '[ack-handler] Status updated (exact match):',
      newStatus,
      'messageId:',
      rawMessageId
    );
    return true;
  }

  // Try partial match for old JSON formats
  if (shortId) {
    console.log('[ack-handler] Exact match not found, trying partial match...');

    const { data: partialMatch, error: partialError } = await supabase
      .from('messages')
      .update({ status: newStatus })
      .like('external_id', `%${shortId}%`)
      .select('id');

    if (!partialError && partialMatch && partialMatch.length > 0) {
      console.log(
        '[ack-handler] Status updated (partial match):',
        newStatus,
        'found:',
        partialMatch.length
      );
      return true;
    }
  }

  return false;
}

/**
 * Create outbound message from ACK event (when message was sent from phone but not tracked)
 */
async function createOutboundMessageFromAck(
  supabase: SupabaseClientType,
  payload: any,
  rawMessageId: string,
  shortId: string | null,
  newStatus: 'delivered' | 'read' | null,
  session: string
): Promise<{ created: boolean; ignored?: boolean; reason?: string }> {
  console.log('[ack-handler] Outbound message not in DB, trying to create via ACK...');

  try {
    const toField = payload.to || payload.chatId || '';
    let resolvedToPhone = normalizePhone(toField);
    let leadFromLid: any = null;

    // Handle LID resolution
    if (isLID(toField)) {
      const lidNumber = toField.replace('@lid', '').replace(/\D/g, '');
      console.log('[ack-handler] LID detected, searching lead by original_lid:', lidNumber);

      const wahaConfig = await getWAHAConfigBySession(supabase, session);
      const tenantId = wahaConfig?.tenantId || null;

      // Search lead by LID
      const existingLeadByLid = await findLeadByLid(supabase, toField, tenantId);

      if (existingLeadByLid) {
        console.log('[ack-handler] Lead found by original_lid:', existingLeadByLid.name);
        resolvedToPhone = normalizePhone(existingLeadByLid.phone);
        leadFromLid = existingLeadByLid;
      } else {
        // Try resolving via WAHA API
        if (wahaConfig) {
          const resolvedPhone = await resolvePhoneFromLID(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            lidNumber
          );
          if (resolvedPhone) {
            console.log('[ack-handler] LID resolved via API:', resolvedPhone);
            resolvedToPhone = normalizePhone(resolvedPhone);
          } else {
            console.log('[ack-handler] Ignoring ACK: LID not resolved and no lead associated');
            return { created: false, ignored: true, reason: 'ack_for_unresolved_lid_no_lead' };
          }
        } else {
          console.log('[ack-handler] Ignoring ACK: LID without WAHA config to resolve');
          return { created: false, ignored: true, reason: 'ack_for_unresolved_lid_no_config' };
        }
      }
    }

    // Validate: ignore if recipient is the instance's own number
    const wahaConfigForAck = await getWAHAConfigBySession(supabase, session);
    if (wahaConfigForAck) {
      const ownPhone = await getInstancePhoneNumber(supabase, wahaConfigForAck.instanceId);
      if (ownPhone && isSelfMessage(resolvedToPhone, ownPhone)) {
        console.log('[ack-handler] Ignoring: recipient is own WhatsApp number');
        return { created: false, ignored: true, reason: 'self_message_ack' };
      }
    }

    // Find lead
    let lead = leadFromLid;
    if (!lead && resolvedToPhone) {
      console.log('[ack-handler] Searching lead by phone:', resolvedToPhone);
      lead = await findLeadByPhone(supabase, resolvedToPhone);
    }

    if (!lead) {
      console.log('[ack-handler] Lead not found for phone:', resolvedToPhone);
      return { created: false };
    }

    console.log('[ack-handler] Lead found for ACK:', lead.id, lead.name);

    // Find or create conversation
    const instanceId = wahaConfigForAck?.instanceId || null;
    const conversation = await findOrCreateConversation(supabase, lead, instanceId, false);

    if (!conversation) {
      console.error('[ack-handler] Failed to find/create conversation');
      return { created: false };
    }

    // Extract message content
    const messageBody =
      payload.body || payload._data?.body || payload.text || payload.caption || '';

    // Detect message type
    let msgType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' = 'text';
    const rawType = payload.type || payload._data?.type || '';
    if (rawType === 'image' || (payload.hasMedia && payload.media?.mimetype?.startsWith('image'))) {
      msgType = 'image';
    } else if (rawType === 'ptt' || rawType === 'audio') {
      msgType = 'audio';
    } else if (rawType === 'video') {
      msgType = 'video';
    } else if (rawType === 'document') {
      msgType = 'document';
    } else if (rawType === 'sticker') {
      msgType = 'sticker';
    }

    const finalContent = messageBody || (msgType !== 'text' ? `[${msgType}]` : '');

    // Create timestamp from payload
    const msgTimestamp = payload.timestamp
      ? new Date(payload.timestamp * 1000).toISOString()
      : new Date().toISOString();

    // Check if message already exists by waha_message_id
    const { data: existingMsgByWaha } = await supabase
      .from('messages')
      .select('id')
      .eq('waha_message_id', shortId)
      .maybeSingle();

    if (existingMsgByWaha) {
      console.log(
        '[ack-handler] Message exists (waha_message_id), updating status only:',
        existingMsgByWaha.id
      );
      await supabase
        .from('messages')
        .update({ status: newStatus || 'sent' })
        .eq('id', existingMsgByWaha.id);
      return { created: true };
    }

    // Create message with waha_message_id to prevent duplication
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        lead_id: lead.id,
        sender_id: null,
        sender_type: 'agent',
        content: finalContent,
        type: msgType,
        direction: 'outbound',
        source: 'mobile',
        external_id: rawMessageId,
        waha_message_id: shortId,
        status: newStatus || 'sent',
        created_at: msgTimestamp,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[ack-handler] Error creating message via ACK:', insertError);
      return { created: false };
    }

    console.log('[ack-handler] Outbound message created via ACK:', newMessage?.id);
    return { created: true };
  } catch (error) {
    console.error('[ack-handler] Error trying to create message via ACK:', error);
    return { created: false };
  }
}

/**
 * Handle WAHA message.ack event
 */
export async function handleAckEvent(
  supabase: SupabaseClientType,
  payload: any,
  session: string
): Promise<Response> {
  const { newStatus, rawMessageId, shortId } = parseAckStatus(payload);

  if (!newStatus || !rawMessageId) {
    return createSuccessResponse({
      success: true,
      event: 'ack',
      status: null,
      messageId: rawMessageId,
    });
  }

  // Try to update existing message
  let found = await updateMessageStatusByIds(supabase, rawMessageId, shortId, newStatus);

  // If not found and is outbound message, try to create it
  if (!found && payload?.fromMe === true) {
    const result = await createOutboundMessageFromAck(
      supabase,
      payload,
      rawMessageId,
      shortId,
      newStatus,
      session
    );

    if (result.ignored) {
      return createIgnoredResponse(result.reason || 'ignored');
    }

    found = result.created;
  }

  if (!found) {
    console.warn(
      '[ack-handler] No message found for messageId:',
      rawMessageId,
      'shortId:',
      shortId
    );
  }

  return createSuccessResponse({
    success: true,
    event: 'ack',
    status: newStatus,
    messageId: rawMessageId,
  });
}
