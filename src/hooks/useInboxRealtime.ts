import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];

interface UseInboxRealtimeOptions {
  selectedConversationId?: string | null;
  onNewIncomingMessage?: (message: Message) => void;
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
 */
export function useInboxRealtime(options: UseInboxRealtimeOptions = {}) {
  const { selectedConversationId, onNewIncomingMessage } = options;
  const queryClient = useQueryClient();
  
  // Use refs to avoid recreating callbacks on every render
  const selectedConversationIdRef = useRef(selectedConversationId);
  const onNewIncomingMessageRef = useRef(onNewIncomingMessage);
  
  // Keep refs in sync
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);
  
  useEffect(() => {
    onNewIncomingMessageRef.current = onNewIncomingMessage;
  }, [onNewIncomingMessage]);

  // Handle new message in selected conversation - optimistic update
  // Using refs to access current values without recreating callback
  const handleMessageInsert = useCallback((payload: any) => {
    const newMessage = payload.new as Message;
    const conversationId = newMessage.conversation_id;
    const currentSelectedId = selectedConversationIdRef.current;
    
    console.log('[InboxRealtime] New message:', { 
      messageId: newMessage.id, 
      conversationId,
      isSelectedConversation: conversationId === currentSelectedId 
    });

    // Optimistic update for messages in selected conversation
    if (conversationId === currentSelectedId) {
      queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
        if (!old) return [newMessage];
        // Avoid duplicates
        if (old.some(m => m.id === newMessage.id)) return old;
        return [...old, newMessage];
      });
    }

    // Notify for incoming messages from leads
    if (newMessage.sender_type === 'lead' && onNewIncomingMessageRef.current) {
      onNewIncomingMessageRef.current(newMessage);
    }

    // Update conversation list (for last_message_at, unread_count, etc.)
    // Use setQueryData for optimistic update if we have the conversation
    queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
      if (!old) return old;
      
      return old.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            last_message_at: newMessage.created_at,
            last_message_content: newMessage.content,
            unread_count: newMessage.sender_type === 'lead' 
              ? (conv.unread_count || 0) + 1 
              : conv.unread_count,
          };
        }
        return conv;
      });
    });
  }, [queryClient]); // Only queryClient as dependency - refs are stable

  // Handle message updates (status changes, starred, etc.)
  const handleMessageUpdate = useCallback((payload: any) => {
    const updatedMessage = payload.new as Message;
    const conversationId = updatedMessage.conversation_id;
    
    console.log('[InboxRealtime] Message updated:', updatedMessage.id);

    // Update message in cache
    queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
      if (!old) return old;
      return old.map(m => m.id === updatedMessage.id ? updatedMessage : m);
    });
  }, [queryClient]);

  // Handle conversation updates
  const handleConversationChange = useCallback((payload: any) => {
    console.log('[InboxRealtime] Conversation change:', payload.eventType);
    const currentSelectedId = selectedConversationIdRef.current;
    
    if (payload.eventType === 'UPDATE') {
      const updated = payload.new;
      queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map(conv => conv.id === updated.id ? { ...conv, ...updated } : conv);
      });
      
      // Also update single conversation query if selected
      if (updated.id === currentSelectedId) {
        queryClient.setQueryData(['conversations', updated.id], (old: any) => {
          if (!old) return old;
          return { ...old, ...updated };
        });
      }
    } else if (payload.eventType === 'INSERT') {
      // New conversation - invalidate to refetch with leads data
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [queryClient]); // Only queryClient - use ref for selectedConversationId

  // Handle lead labels changes (for conversation list labels display)
  const handleLeadLabelsChange = useCallback((payload: any) => {
    console.log('[InboxRealtime] Lead labels change:', payload.eventType);
    // Invalidate conversations to update labels in list
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    // Also invalidate lead labels query for the detail panel
    queryClient.invalidateQueries({ queryKey: ['lead-labels'] });
  }, [queryClient]);

  useEffect(() => {
    console.log('[InboxRealtime] Setting up unified subscription');

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
        console.log('[InboxRealtime] Subscription status:', status);
      });

    return () => {
      console.log('[InboxRealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  // Empty dependency array - callbacks use refs for dynamic values
  // This ensures the subscription is set up once and never recreated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
