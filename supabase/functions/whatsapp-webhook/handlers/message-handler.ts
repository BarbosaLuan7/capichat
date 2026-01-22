import {
  WAHAMessage,
  normalizePhone,
  isLID,
  getWAHAConfigBySession,
  extractRealPhoneFromPayload,
  resolvePhoneFromLID,
  getMessageContent,
  uploadMediaToStorage,
} from '../../_shared/index.ts';
import type {
  SupabaseClientType,
  WAHAConfig,
  Lead,
  Conversation,
  WebhookContext,
} from '../types.ts';
import { createIgnoredResponse, createSuccessResponse, createErrorResponse } from './auth.ts';
import { validateContact, isSelfMessage } from '../validators/filter-validator.ts';
import { validateMessageContent } from '../validators/message-validator.ts';
import {
  findLead,
  updateExistingLead,
  createNewLead,
  findLeadByLid,
  getInstancePhoneNumber,
  getContactNameFromAPI,
} from '../processors/lead-processor.ts';
import { findOrCreateConversation } from '../processors/conversation-processor.ts';
import {
  extractWahaMessageId,
  checkMessageExists,
  createMessage,
  dispatchWebhook,
} from '../processors/message-processor.ts';
import {
  processMediaFromMessage,
  isValidBase64,
  extractBase64FromPayload,
  uploadBase64ToStorage,
} from '../processors/media-processor.ts';

/**
 * Extract sender info from WAHA message payload
 */
export async function extractSenderInfo(
  supabase: SupabaseClientType,
  payload: WAHAMessage & { _data?: any },
  body: any,
  isFromMe: boolean
): Promise<{
  senderPhone: string;
  senderName: string;
  isFromFacebookLid: boolean;
  originalLid: string | null;
  filterReason: string | null;
}> {
  // Determine contact based on message direction
  let rawContact: string;
  if (isFromMe) {
    rawContact = payload.to || payload.chatId || '';
    console.log('[message-handler] OUTBOUND message - recipient:', rawContact);
  } else {
    rawContact = payload.from || payload.chatId || '';
    console.log('[message-handler] INBOUND message - sender:', rawContact);
  }

  // Filter groups and broadcasts
  const filterReason = validateContact(rawContact);
  if (filterReason) {
    return {
      senderPhone: '',
      senderName: '',
      isFromFacebookLid: false,
      originalLid: null,
      filterReason,
    };
  }

  let senderPhone = '';
  let senderName = '';
  let isFromFacebookLid = false;
  let originalLid: string | null = null;

  // Handle LID (Facebook Lead ID)
  if (isLID(rawContact)) {
    console.log('[message-handler] Facebook LID detected, searching for real number...');
    isFromFacebookLid = true;
    originalLid = rawContact.replace('@lid', '').replace(/\D/g, '');

    // Try extracting from payload first
    let realPhone = extractRealPhoneFromPayload(body.payload);

    // If not found, try WAHA API
    if (!realPhone) {
      const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
      if (wahaConfig) {
        realPhone = await resolvePhoneFromLID(
          wahaConfig.baseUrl,
          wahaConfig.apiKey,
          wahaConfig.sessionName,
          rawContact
        );

        if (realPhone) {
          isFromFacebookLid = false;
          console.log('[message-handler] Real number resolved via WAHA API:', realPhone);
        }
      }
    } else {
      isFromFacebookLid = false;
    }

    if (realPhone) {
      senderPhone = normalizePhone(realPhone);
    } else {
      // For outbound messages to unresolved LID, try finding existing lead
      if (isFromMe) {
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        const tenantId = wahaConfig?.tenantId || null;
        const existingLeadByLid = await findLeadByLid(supabase, rawContact, tenantId);

        if (existingLeadByLid) {
          console.log('[message-handler] Lead found by original_lid:', existingLeadByLid.name);
          senderPhone = normalizePhone(existingLeadByLid.phone);
          senderName = existingLeadByLid.name || '';
          isFromFacebookLid = true;
        } else {
          console.log('[message-handler] Ignoring outbound to unresolved LID without lead');
          return {
            senderPhone: '',
            senderName: '',
            isFromFacebookLid,
            originalLid,
            filterReason: 'outbound_to_unresolved_lid_no_lead',
          };
        }
      }

      // For inbound from unresolved LID, use LID as temporary identifier
      if (!senderPhone) {
        console.warn(
          '[message-handler] Could not extract real number from LID, using as temporary identifier'
        );
        senderPhone = originalLid || normalizePhone(rawContact);
      }
    }
  } else {
    senderPhone = normalizePhone(rawContact);
  }

  // Extract sender name
  if (isFromMe) {
    // For outbound messages, pushName is OUR name, need to fetch recipient name via API
    console.log('[message-handler] Outbound message - fetching recipient name via API...');
    const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
    if (wahaConfig) {
      const existingLead = await findLead(supabase, senderPhone);
      senderName =
        (await getContactNameFromAPI(wahaConfig, senderPhone, existingLead?.country_code)) || '';
      console.log('[message-handler] Recipient name obtained via API:', senderName);
    }
  } else {
    // For inbound messages, use pushName from payload
    senderName =
      payload.pushName ||
      body.payload?._data?.pushName ||
      body.payload?._data?.notifyName ||
      body.pushName ||
      body.payload?.chat?.contact?.pushname ||
      body.payload?.sender?.pushName ||
      '';
  }

  console.log(
    '[message-handler] Name extracted:',
    senderName,
    'phone normalized:',
    senderPhone,
    'isLID:',
    isFromFacebookLid,
    'isFromMe:',
    isFromMe
  );

  return {
    senderPhone,
    senderName,
    isFromFacebookLid,
    originalLid,
    filterReason: null,
  };
}

/**
 * Check if message is from the instance's own number (self-message)
 */
export async function checkSelfMessage(
  supabase: SupabaseClientType,
  senderPhone: string,
  session: string
): Promise<boolean> {
  const wahaConfig = await getWAHAConfigBySession(supabase, session);
  if (!wahaConfig) return false;

  const instancePhone = await getInstancePhoneNumber(supabase, wahaConfig.instanceId);
  if (!instancePhone) return false;

  return isSelfMessage(senderPhone, instancePhone);
}

/**
 * Handle duplicate message (update media if needed)
 */
export async function handleDuplicateMessage(
  supabase: SupabaseClientType,
  existingMessage: any,
  messageData: WAHAMessage,
  provider: 'waha' | 'meta',
  senderPhone: string,
  session: string
): Promise<Response> {
  // If media message without media_url, try to update with media from this event
  const isMediaType =
    existingMessage.type && ['image', 'audio', 'video', 'document'].includes(existingMessage.type);

  if (isMediaType && !existingMessage.media_url) {
    console.log('[message-handler] Existing media message without media_url, trying to extract...');

    const { mediaUrl: eventMediaUrl, type: eventType } = getMessageContent(messageData, provider);

    if (eventMediaUrl) {
      console.log('[message-handler] Media found in this event, uploading...');

      const existingLead = await findLead(supabase, senderPhone);
      const wahaConfig = await getWAHAConfigBySession(supabase, session);

      if (existingLead && wahaConfig) {
        try {
          const finalMediaUrl = await uploadMediaToStorage(
            supabase,
            eventMediaUrl,
            eventType,
            existingLead.id,
            wahaConfig
          );

          if (finalMediaUrl) {
            await supabase
              .from('messages')
              .update({ media_url: finalMediaUrl })
              .eq('id', existingMessage.id);

            console.log(
              '[message-handler] media_url updated successfully:',
              finalMediaUrl.substring(0, 50)
            );
          }
        } catch (uploadError) {
          console.error('[message-handler] Error uploading media:', uploadError);
        }
      }
    }
  }

  console.log(
    '[message-handler] Message already processed (waha_message_id):',
    existingMessage.waha_message_id
  );

  return createSuccessResponse({
    success: true,
    duplicate: true,
    existing_message_id: existingMessage.id,
    matched_by: 'waha_message_id',
    matched_value: existingMessage.waha_message_id,
  });
}

/**
 * Process WAHA message event
 */
export async function processWAHAMessage(
  supabase: SupabaseClientType,
  payload: WAHAMessage & { _data?: any },
  body: any,
  session: string
): Promise<Response> {
  const isFromMe = payload.fromMe || false;
  const externalMessageId = payload.id || '';

  // Log message details
  console.log('[message-handler] ===== MESSAGE RECEIVED =====');
  console.log('[message-handler] fromMe:', isFromMe);
  console.log('[message-handler] external_id:', externalMessageId);
  console.log('[message-handler] type:', payload.type);
  console.log('[message-handler] hasMedia:', payload.hasMedia);
  console.log('[message-handler] ==============================');

  // Extract sender info
  const senderInfo = await extractSenderInfo(supabase, payload, body, isFromMe);

  if (senderInfo.filterReason) {
    return createIgnoredResponse(senderInfo.filterReason, { lid: senderInfo.originalLid });
  }

  const { senderPhone, senderName, isFromFacebookLid, originalLid } = senderInfo;

  if (!senderPhone) {
    return createErrorResponse('Invalid message data - no phone', 400);
  }

  // Check for self-message
  if (await checkSelfMessage(supabase, senderPhone, session)) {
    console.log('[message-handler] Ignoring self-message:', senderPhone);
    return createIgnoredResponse('self_message', { phone: senderPhone });
  }

  // Calculate waha_message_id for deduplication
  const wahaMessageId = extractWahaMessageId(externalMessageId);
  console.log(
    '[message-handler] waha_message_id:',
    wahaMessageId,
    '| original:',
    externalMessageId
  );

  // Check for duplicate
  if (wahaMessageId) {
    const { exists, existingMessage } = await checkMessageExists(
      supabase,
      wahaMessageId,
      externalMessageId
    );
    if (exists && existingMessage) {
      return handleDuplicateMessage(
        supabase,
        existingMessage,
        payload,
        'waha',
        senderPhone,
        session
      );
    }
  }

  // Extract message content
  const { content, type, mediaUrl, isSystemMessage, quotedMessage } = getMessageContent(
    payload,
    'waha'
  );

  // Ignore system notifications
  if (isSystemMessage) {
    console.log('[message-handler] Ignoring system notification');
    return createIgnoredResponse('system_notification');
  }

  // Validate message content
  const contentValidation = validateMessageContent(content, mediaUrl);
  if (!contentValidation.isValid) {
    return createIgnoredResponse(contentValidation.reason || 'invalid_content');
  }

  console.log(
    '[message-handler] Content:',
    content.substring(0, 100),
    'Type:',
    type,
    'MediaUrl:',
    mediaUrl ? 'present' : 'none'
  );

  // Find or create lead
  const wahaConfig = await getWAHAConfigBySession(supabase, session);
  let lead = await findLead(supabase, senderPhone, senderName);

  if (lead) {
    console.log('[message-handler] Lead found:', lead.id, '| name:', lead.name);
    await updateExistingLead(
      supabase,
      lead,
      senderName,
      isFromFacebookLid,
      originalLid,
      wahaConfig,
      senderPhone
    );
  } else {
    lead = await createNewLead(
      supabase,
      senderPhone,
      senderName,
      isFromFacebookLid,
      originalLid,
      wahaConfig,
      wahaConfig?.tenantId || null
    );

    if (!lead) {
      return createErrorResponse('Error creating lead', 500);
    }
  }

  // Find or create conversation
  const whatsappInstanceId = wahaConfig?.instanceId || null;
  const conversation = await findOrCreateConversation(
    supabase,
    lead,
    whatsappInstanceId,
    !isFromMe
  );

  if (!conversation) {
    console.error('[message-handler] CRITICAL ERROR: conversation is null before creating message');
    return createErrorResponse('No conversation found - cannot create message', 500);
  }

  // Process media
  let finalMediaUrl = await processMediaFromMessage(
    supabase,
    payload,
    type,
    mediaUrl,
    lead.id,
    wahaConfig,
    externalMessageId,
    isFromMe
  );

  // Create message
  const {
    message,
    isDuplicate,
    error: messageError,
  } = await createMessage(
    supabase,
    conversation,
    lead,
    content,
    type,
    finalMediaUrl,
    isFromMe,
    externalMessageId,
    wahaMessageId,
    quotedMessage
  );

  if (isDuplicate) {
    return createSuccessResponse({
      success: true,
      duplicate: true,
      existing_message_id: message?.id,
      matched_by: 'upsert_conflict',
    });
  }

  if (messageError) {
    return createErrorResponse('Error creating message', 500);
  }

  console.log('[message-handler] Message created:', message?.id, 'waha_message_id:', wahaMessageId);

  // Dispatch webhook to external systems
  if (message) {
    await dispatchWebhook(message, lead, conversation);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        message_id: message?.id || null,
        conversation_id: conversation.id,
        lead_id: lead.id,
        provider: 'waha',
        external_id: externalMessageId,
      },
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
}
