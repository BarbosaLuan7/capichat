import type { SupabaseClientType, Message, Lead, Conversation } from '../types.ts';

/**
 * Extract short ID (waha_message_id) from external_id
 * Format: "true_554599957851@c.us_3EB0725EB8EE5F6CC14B33" -> "3EB0725EB8EE5F6CC14B33"
 * Or short format: "3EB0725EB8EE5F6CC14B33" -> "3EB0725EB8EE5F6CC14B33"
 */
export function extractWahaMessageId(externalMessageId: string): string | null {
  if (!externalMessageId) return null;

  if (typeof externalMessageId === 'string' && externalMessageId.includes('_')) {
    const parts = externalMessageId.split('_');
    return parts[parts.length - 1];
  }

  return externalMessageId;
}

/**
 * Check if message already exists by waha_message_id (deduplication)
 */
export async function checkMessageExists(
  supabase: SupabaseClientType,
  wahaMessageId: string,
  externalMessageId: string
): Promise<{ exists: boolean; existingMessage: any | null }> {
  console.log(
    '[message-processor] Checking for duplicate:',
    wahaMessageId,
    'or',
    externalMessageId
  );

  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id, waha_message_id, media_url, type, conversation_id')
    .or(`waha_message_id.eq.${wahaMessageId},waha_message_id.eq.${externalMessageId}`)
    .limit(1)
    .maybeSingle();

  if (existingMessage) {
    console.log(
      '[message-processor] Duplicate found:',
      existingMessage.id,
      'matched:',
      existingMessage.waha_message_id
    );
    return { exists: true, existingMessage };
  }

  return { exists: false, existingMessage: null };
}

/**
 * Create message with upsert (uses waha_message_id for idempotency)
 */
export async function createMessage(
  supabase: SupabaseClientType,
  conversation: Conversation,
  lead: Lead,
  content: string,
  type: string,
  mediaUrl: string | undefined,
  isFromMe: boolean,
  externalMessageId: string,
  wahaMessageId: string | null,
  quotedMessage?: { id: string; body?: string; type?: string; from?: string }
): Promise<{ message: Message | null; isDuplicate: boolean; error?: string }> {
  // Determine direction and sender type
  const direction = isFromMe ? 'outbound' : 'inbound';
  const senderType = isFromMe ? 'agent' : 'lead';
  const source = isFromMe ? 'mobile' : 'lead';

  console.log(
    '[message-processor] Creating message - direction:',
    direction,
    'sender:',
    senderType,
    'source:',
    source
  );

  const messageData: Record<string, unknown> = {
    conversation_id: conversation.id,
    lead_id: lead.id,
    sender_id: isFromMe ? null : lead.id,
    sender_type: senderType,
    content: content,
    type: type as 'text' | 'image' | 'audio' | 'video' | 'document',
    media_url: mediaUrl,
    direction: direction,
    source: source,
    status: isFromMe ? 'sent' : 'delivered',
    external_id: externalMessageId || null,
    waha_message_id: wahaMessageId,
  };

  // Add quote data if exists
  if (quotedMessage) {
    messageData.reply_to_external_id = quotedMessage.id;
    messageData.quoted_message = quotedMessage;
    console.log('[message-processor] Saving message with quote:', quotedMessage.id);
  }

  // Use upsert for idempotency
  let message: Message | null = null;

  if (wahaMessageId) {
    const { data: upsertedMessage, error: upsertError } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'waha_message_id',
        ignoreDuplicates: true,
      })
      .select('*')
      .maybeSingle();

    if (upsertError) {
      // Handle duplicate conflict
      if (upsertError.code === '23505') {
        console.log('[message-processor] Duplicate detected on upsert, ignoring');
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('waha_message_id', wahaMessageId)
          .maybeSingle();

        return {
          message: existingMsg as Message | null,
          isDuplicate: true,
        };
      }

      console.error('[message-processor] Error creating message:', upsertError);
      return { message: null, isDuplicate: false, error: upsertError.message };
    }

    message = upsertedMessage;

    // Handle case where upsert returns null (duplicate ignored)
    if (!message) {
      console.log('[message-processor] Upsert returned null, searching for existing message...');
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('waha_message_id', wahaMessageId)
        .maybeSingle();

      if (existingMsg) {
        console.log('[message-processor] Existing message found:', existingMsg.id);
        message = existingMsg;
      }
    }
  } else {
    // Without waha_message_id, use normal insert
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('*')
      .single();

    if (insertError) {
      console.error('[message-processor] Error creating message:', insertError);
      return { message: null, isDuplicate: false, error: insertError.message };
    }

    message = insertedMessage;
  }

  console.log(
    '[message-processor] Message created:',
    message?.id,
    'waha_message_id:',
    wahaMessageId
  );

  return { message, isDuplicate: false };
}

/**
 * Update message status
 */
export async function updateMessageStatus(
  supabase: SupabaseClientType,
  messageId: string,
  status: 'delivered' | 'read'
): Promise<boolean> {
  const { error } = await supabase.from('messages').update({ status }).eq('id', messageId);

  if (error) {
    console.error('[message-processor] Error updating status:', error);
    return false;
  }

  console.log('[message-processor] Status updated to:', status, 'for message:', messageId);
  return true;
}

/**
 * Find message by external_id (various formats)
 */
export async function findMessageByExternalId(
  supabase: SupabaseClientType,
  rawMessageId: string,
  shortId: string | null
): Promise<{ found: boolean; messageId?: string }> {
  // Try short ID first
  if (shortId) {
    const { data: shortMatch } = await supabase
      .from('messages')
      .update({ status: 'delivered' })
      .eq('external_id', shortId)
      .select('id');

    if (shortMatch && shortMatch.length > 0) {
      console.log('[message-processor] Found by shortId:', shortId);
      return { found: true, messageId: shortMatch[0].id };
    }
  }

  // Try exact match
  const { data: exactMatch } = await supabase
    .from('messages')
    .select('id')
    .eq('external_id', rawMessageId)
    .maybeSingle();

  if (exactMatch) {
    console.log('[message-processor] Found by exact match:', rawMessageId);
    return { found: true, messageId: exactMatch.id };
  }

  // Try partial match (for old JSON formats)
  if (shortId) {
    console.log('[message-processor] Trying partial match...');
    const { data: partialMatch } = await supabase
      .from('messages')
      .select('id')
      .like('external_id', `%${shortId}%`)
      .limit(1)
      .maybeSingle();

    if (partialMatch) {
      console.log('[message-processor] Found by partial match');
      return { found: true, messageId: partialMatch.id };
    }
  }

  return { found: false };
}

/**
 * Dispatch webhook to external systems (N8N, Make, etc.)
 */
export async function dispatchWebhook(
  message: Message,
  lead: Lead,
  conversation: Conversation
): Promise<void> {
  try {
    const webhookEvent = message.direction === 'inbound' ? 'message.received' : 'message.sent';
    console.log('[message-processor] Dispatching webhook:', webhookEvent);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: webhookEvent,
        data: {
          message,
          lead,
          conversation,
        },
      }),
    });

    const result = await response.text();
    console.log(
      '[message-processor] dispatch-webhook response:',
      response.status,
      result.substring(0, 150)
    );
  } catch (error) {
    console.error('[message-processor] Error dispatching webhook:', error);
  }
}
