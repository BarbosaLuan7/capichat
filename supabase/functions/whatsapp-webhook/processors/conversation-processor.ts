import type { SupabaseClientType, Conversation, Lead } from '../types.ts';

/**
 * Find existing conversation for a lead and WhatsApp instance
 * Each WhatsApp instance is a separate channel, so conversations are instance-specific
 */
export async function findConversation(
  supabase: SupabaseClientType,
  leadId: string,
  whatsappInstanceId: string | null
): Promise<Conversation | null> {
  console.log(
    '[conversation-processor] Searching conversation for lead:',
    leadId,
    'instance:',
    whatsappInstanceId
  );

  // Exact match (lead_id + whatsapp_instance_id)
  // IMPORTANT: Each WhatsApp instance = separate channel, no fallback to other instances
  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('lead_id', leadId)
    .eq('whatsapp_instance_id', whatsappInstanceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConversation) {
    console.log(
      '[conversation-processor] Conversation found:',
      existingConversation.id,
      'status:',
      existingConversation.status
    );
  }

  return existingConversation;
}

/**
 * Create new conversation for a lead
 */
export async function createConversation(
  supabase: SupabaseClientType,
  lead: Lead,
  whatsappInstanceId: string | null
): Promise<Conversation | null> {
  console.log('[conversation-processor] Creating new conversation for lead:', lead.id);

  const { data: newConversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      lead_id: lead.id,
      status: 'open',
      assigned_to: lead.assigned_to,
      whatsapp_instance_id: whatsappInstanceId,
    })
    .select('*')
    .single();

  if (createError) {
    // Race condition: another request may have created the conversation
    console.log(
      '[conversation-processor] Error creating conversation, searching for existing:',
      createError.code,
      createError.message
    );

    const { data: fallbackConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('whatsapp_instance_id', whatsappInstanceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackConv) {
      console.log(
        '[conversation-processor] Conversation found after fallback (same instance):',
        fallbackConv.id
      );
      return fallbackConv;
    }

    console.error('[conversation-processor] Failed to create conversation:', createError);
    return null;
  }

  console.log(
    '[conversation-processor] Conversation created:',
    newConversation.id,
    'whatsapp_instance_id:',
    whatsappInstanceId
  );

  return newConversation;
}

/**
 * Reopen a resolved or pending conversation
 */
export async function reopenConversation(
  supabase: SupabaseClientType,
  conversationId: string
): Promise<void> {
  console.log('[conversation-processor] Reopening conversation:', conversationId);

  await supabase.from('conversations').update({ status: 'open' }).eq('id', conversationId);
}

/**
 * Update conversation with WhatsApp instance ID
 */
export async function updateConversationInstance(
  supabase: SupabaseClientType,
  conversationId: string,
  whatsappInstanceId: string
): Promise<void> {
  await supabase
    .from('conversations')
    .update({ whatsapp_instance_id: whatsappInstanceId })
    .eq('id', conversationId);
}

/**
 * Find or create conversation for a lead
 * Handles reopening resolved conversations for inbound messages
 */
export async function findOrCreateConversation(
  supabase: SupabaseClientType,
  lead: Lead,
  whatsappInstanceId: string | null,
  isInbound: boolean
): Promise<Conversation | null> {
  // Find existing conversation
  let conversation = await findConversation(supabase, lead.id, whatsappInstanceId);

  if (conversation) {
    // Reopen if resolved/pending and is inbound message
    if (isInbound && (conversation.status === 'resolved' || conversation.status === 'pending')) {
      await reopenConversation(supabase, conversation.id);
    }

    // Update instance ID if not set
    if (!conversation.whatsapp_instance_id && whatsappInstanceId) {
      await updateConversationInstance(supabase, conversation.id, whatsappInstanceId);
    }

    return conversation;
  }

  // Create new conversation
  return await createConversation(supabase, lead, whatsappInstanceId);
}
