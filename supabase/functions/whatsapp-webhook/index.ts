import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// Imports from shared modules
// ============================================
import { corsHeaders, WAHAMessage, getMessageContent } from '../_shared/index.ts';

// ============================================
// Local module imports
// ============================================
import type { MetaWebhookEntry } from './types.ts';

// Handlers
import {
  handleCorsPreflightRequest,
  handleMethodNotAllowed,
  getSignatureFromHeaders,
  verifySignature,
  createSuccessResponse,
  createIgnoredResponse,
  createErrorResponse,
} from './handlers/auth.ts';
import { handleAckEvent } from './handlers/ack-handler.ts';
import { processWAHAMessage } from './handlers/message-handler.ts';
import {
  detectProvider,
  isWAHAAckEvent,
  isWAHAMessageEvent,
  processMetaWebhook,
} from './handlers/payload-detection.ts';

// Processors
import { findLead, updateExistingLead, createNewLead } from './processors/lead-processor.ts';
import { findOrCreateConversation } from './processors/conversation-processor.ts';
import {
  extractWahaMessageId,
  checkMessageExists,
  createMessage,
  dispatchWebhook,
} from './processors/message-processor.ts';
import { processMediaFromMessage } from './processors/media-processor.ts';

// Validators
import { validateMessageContent } from './validators/message-validator.ts';

// ============================================
// Main webhook handler
// ============================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  if (req.method !== 'POST') {
    return handleMethodNotAllowed();
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const signature = getSignatureFromHeaders(req);
    await verifySignature(supabase, rawBody, signature);

    // Parse body
    const body = JSON.parse(rawBody);
    console.log('[whatsapp-webhook] Received:', JSON.stringify(body).substring(0, 1000));

    // Detect provider
    const { provider, event } = detectProvider(body);

    // ========== WAHA Provider ==========
    if (provider === 'waha') {
      console.log('[whatsapp-webhook] WAHA payload:', JSON.stringify(body));

      // Handle ACK events
      if (isWAHAAckEvent(event)) {
        return await handleAckEvent(supabase, body.payload || {}, body.session || 'default');
      }

      // Handle message events
      if (isWAHAMessageEvent(event)) {
        const payload = body.payload as WAHAMessage & { _data?: any };
        return await processWAHAMessage(supabase, payload, body, body.session || 'default');
      }

      // Unhandled WAHA event
      console.log('[whatsapp-webhook] Unhandled WAHA event:', event);
      return createIgnoredResponse('event not handled', { event });
    }

    // ========== Meta Provider ==========
    if (provider === 'meta') {
      const { messageData, senderPhone, senderName, externalMessageId, statusResponse } =
        await processMetaWebhook(supabase, body.entry as MetaWebhookEntry[]);

      // If status update was handled, return that response
      if (statusResponse) {
        return statusResponse;
      }

      // No message data found
      if (!messageData) {
        return createIgnoredResponse('no_messages_in_payload');
      }

      // Validate message data
      if (!senderPhone) {
        console.log('[whatsapp-webhook] Invalid data:', {
          messageData: !!messageData,
          senderPhone,
        });
        return createErrorResponse('Invalid message data', 400);
      }

      // Extract message content
      const { content, type, mediaUrl, isSystemMessage, quotedMessage } = getMessageContent(
        messageData,
        'meta'
      );

      // Ignore system notifications
      if (isSystemMessage) {
        console.log('[whatsapp-webhook] Ignoring system notification');
        return createIgnoredResponse('system_notification');
      }

      // Validate content
      const contentValidation = validateMessageContent(content, mediaUrl);
      if (!contentValidation.isValid) {
        return createIgnoredResponse(contentValidation.reason || 'invalid_content');
      }

      // Check for duplicate
      const wahaMessageId = extractWahaMessageId(externalMessageId);
      if (wahaMessageId) {
        const { exists, existingMessage } = await checkMessageExists(
          supabase,
          wahaMessageId,
          externalMessageId
        );
        if (exists) {
          return createSuccessResponse({
            success: true,
            duplicate: true,
            existing_message_id: existingMessage?.id,
            matched_by: 'waha_message_id',
          });
        }
      }

      console.log('[whatsapp-webhook] Processing message from:', senderPhone, 'Name:', senderName);

      // Find or create lead
      let lead = await findLead(supabase, senderPhone, senderName);

      if (lead) {
        console.log('[whatsapp-webhook] Lead found:', lead.id, '| name:', lead.name);
        await updateExistingLead(supabase, lead, senderName, false, null, null, senderPhone);
      } else {
        lead = await createNewLead(supabase, senderPhone, senderName, false, null, null, null);

        if (!lead) {
          return createErrorResponse('Error creating lead', 500);
        }
      }

      // Find or create conversation
      const conversation = await findOrCreateConversation(supabase, lead, null, true);

      if (!conversation) {
        console.error('[whatsapp-webhook] CRITICAL ERROR: conversation is null');
        return createErrorResponse('No conversation found - cannot create message', 500);
      }

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
        mediaUrl,
        false, // Meta only receives inbound
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

      console.log('[whatsapp-webhook] Message created:', message?.id);

      // Dispatch webhook
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
            provider: 'meta',
            external_id: externalMessageId,
          },
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== Unknown Provider ==========
    console.log('[whatsapp-webhook] Unknown payload format');
    return createErrorResponse('Unknown payload format', 400);
  } catch (error: unknown) {
    console.error('[whatsapp-webhook] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
