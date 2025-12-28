import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];

interface UseInboxRealtimeOptions {
  selectedConversationId?: string | null;
  onNewIncomingMessage?: (message: Message, leadName?: string) => void;
  // Optimistic update functions from infinite hooks
  addMessageOptimistically?: (message: Message) => void;
  updateMessageOptimistically?: (messageId: string, updates: Partial<Message>) => void;
  addConversationOptimistically?: (conversation: any) => void;
  updateConversationOptimistically?: (conversationId: string, updates: any) => void;
}

/**
 * Unified realtime hook for the Inbox page.
 * Consolidates all inbox-related subscriptions into a single channel.
 * 
 * Improvements over previous approach:
 * - Single channel instead of 6+ separate channels
 * - Specific invalidations instead of broad ['conversations'] invalidation
 * - Optimistic updates for messages in the selected conversation
 * - Stable refs to prevent subscription reconnection loops
 * - Integration with infinite pagination hooks
 */
export function useInboxRealtime(options: UseInboxRealtimeOptions = {}) {
  const {
    selectedConversationId,
    onNewIncomingMessage,
    addMessageOptimistically,
    updateMessageOptimistically,
    addConversationOptimistically,
    updateConversationOptimistically,
  } = options;
  const queryClient = useQueryClient();
  
  // Use refs to avoid recreating callbacks on every render
  const selectedConversationIdRef = useRef(selectedConversationId);
  const onNewIncomingMessageRef = useRef(onNewIncomingMessage);
  const addMessageOptimisticallyRef = useRef(addMessageOptimistically);
  const updateMessageOptimisticallyRef = useRef(updateMessageOptimistically);
  const addConversationOptimisticallyRef = useRef(addConversationOptimistically);
  const updateConversationOptimisticallyRef = useRef(updateConversationOptimistically);
  
  // Keep refs in sync
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);
  
  useEffect(() => {
    onNewIncomingMessageRef.current = onNewIncomingMessage;
  }, [onNewIncomingMessage]);

  useEffect(() => {
    addMessageOptimisticallyRef.current = addMessageOptimistically;
  }, [addMessageOptimistically]);

  useEffect(() => {
    updateMessageOptimisticallyRef.current = updateMessageOptimistically;
  }, [updateMessageOptimistically]);

  useEffect(() => {
    addConversationOptimisticallyRef.current = addConversationOptimistically;
  }, [addConversationOptimistically]);

  useEffect(() => {
    updateConversationOptimisticallyRef.current = updateConversationOptimistically;
  }, [updateConversationOptimistically]);

  // Handle new message in selected conversation - optimistic update
  const handleMessageInsert = useCallback((payload: any) => {
    const newMessage = payload.new as Message;
    const conversationId = newMessage.conversation_id;
    const currentSelectedId = selectedConversationIdRef.current;
    
    logger.log('[InboxRealtime] New message:', { 
      messageId: newMessage.id, 
      conversationId,
      isSelectedConversation: conversationId === currentSelectedId 
    });

    // Use infinite hook's optimistic update if available (for selected conversation)
    if (conversationId === currentSelectedId && addMessageOptimisticallyRef.current) {
      addMessageOptimisticallyRef.current(newMessage);
    } else {
      // Fallback to old query update for non-infinite queries
      queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
        if (!old) return [newMessage];
        if (old.some(m => m.id === newMessage.id)) return old;
        return [...old, newMessage];
      });
    }

    // Notify for incoming messages from leads (if not the selected conversation)
    if (newMessage.sender_type === 'lead' && conversationId !== currentSelectedId && onNewIncomingMessageRef.current) {
      // Get lead name from conversations cache if available
      const conversations = queryClient.getQueryData<any[]>(['conversations']);
      const conv = conversations?.find(c => c.id === conversationId);
      const leadName = conv?.leads?.whatsapp_name || conv?.leads?.name;
      onNewIncomingMessageRef.current(newMessage, leadName);
    }

    // Update conversation in infinite list if function available
    if (updateConversationOptimisticallyRef.current) {
      const newUnreadCount = newMessage.sender_type === 'lead' && conversationId !== currentSelectedId ? 1 : 0;
      updateConversationOptimisticallyRef.current(conversationId, {
        last_message_at: newMessage.created_at,
        last_message_content: newMessage.content,
        unread_count_increment: newUnreadCount,
      });
    } else {
      // Fallback to old method
      queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
        if (!old) return old;
        
        const existingConv = old.find(conv => conv.id === conversationId);
        if (!existingConv) return old;
        
        const newUnreadCount = newMessage.sender_type === 'lead' 
          ? (existingConv.unread_count || 0) + 1 
          : existingConv.unread_count;
        
        if (
          existingConv.last_message_at === newMessage.created_at &&
          existingConv.last_message_content === newMessage.content &&
          existingConv.unread_count === newUnreadCount
        ) {
          return old;
        }
        
        return old.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              last_message_at: newMessage.created_at,
              last_message_content: newMessage.content,
              unread_count: newUnreadCount,
            };
          }
          return conv;
        });
      });
    }
  }, [queryClient]);

  // Handle message updates (status changes, starred, etc.)
  const handleMessageUpdate = useCallback((payload: any) => {
    const updatedMessage = payload.new as Message;
    const oldMessage = payload.old as Message | undefined;
    const conversationId = updatedMessage.conversation_id;
    const currentSelectedId = selectedConversationIdRef.current;
    
    if (oldMessage && oldMessage.status !== updatedMessage.status) {
      logger.log('[InboxRealtime] Message status changed:', {
        id: updatedMessage.id,
        oldStatus: oldMessage.status,
        newStatus: updatedMessage.status
      });
    } else {
      logger.log('[InboxRealtime] Message updated:', updatedMessage.id);
    }

    // Use infinite hook's optimistic update if available
    if (conversationId === currentSelectedId && updateMessageOptimisticallyRef.current) {
      updateMessageOptimisticallyRef.current(updatedMessage.id, updatedMessage);
    } else {
      // Fallback to old query update
      queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
        if (!old) return old;
        return old.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m);
      });
    }
  }, [queryClient]);

  // Handle conversation updates
  const handleConversationChange = useCallback((payload: any) => {
    logger.log('[InboxRealtime] Conversation change:', payload.eventType);
    const currentSelectedId = selectedConversationIdRef.current;
    
    if (payload.eventType === 'UPDATE') {
      const updated = payload.new;
      
      // Use infinite hook's optimistic update if available
      if (updateConversationOptimisticallyRef.current) {
        updateConversationOptimisticallyRef.current(updated.id, updated);
      } else {
        queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
          if (!old) return old;
          return old.map(conv => conv.id === updated.id ? { ...conv, ...updated } : conv);
        });
      }
      
      // Also update single conversation query if selected
      if (updated.id === currentSelectedId) {
        queryClient.setQueryData(['conversations', updated.id], (old: any) => {
          if (!old) return old;
          return { ...old, ...updated };
        });
      }
    } else if (payload.eventType === 'INSERT') {
      // New conversation - invalidate to refetch with leads data
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
    }
  }, [queryClient]);

  // Handle lead labels changes (for conversation list labels display)
  const handleLeadLabelsChange = useCallback((payload: any) => {
    logger.log('[InboxRealtime] Lead labels change:', payload.eventType);
    // Invalidate conversations to update labels in list
    queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
    // Also invalidate lead labels query for the detail panel
    queryClient.invalidateQueries({ queryKey: ['lead-labels'] });
  }, [queryClient]);

  useEffect(() => {
    logger.log('[InboxRealtime] Setting up unified subscription');

    const channel = supabase
      .channel('inbox-unified-realtime')
      // Listen to all messages for conversation list updates
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        handleMessageInsert
      )
      // Listen to message updates (starred, status, etc.)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        handleMessageUpdate
      )
      // Listen to conversation changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        handleConversationChange
      )
      // Listen to lead_labels for updating labels in conversation list
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_labels',
        },
        handleLeadLabelsChange
      )
      .subscribe((status) => {
        logger.log('[InboxRealtime] Subscription status:', status);
      });

    return () => {
      logger.log('[InboxRealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  // Empty dependency array - callbacks use refs for dynamic values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
