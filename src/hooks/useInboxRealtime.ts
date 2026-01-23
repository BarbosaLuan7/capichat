import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];

interface UseInboxRealtimeOptions {
  selectedConversationId?: string | null;
  onNewIncomingMessage?: (message: Message, leadName?: string) => void;
  // Callback to mark selected conversation as read when new message arrives
  onMarkSelectedConversationAsRead?: (conversationId: string) => void;
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
    onMarkSelectedConversationAsRead,
    addMessageOptimistically,
    updateMessageOptimistically,
    addConversationOptimistically,
    updateConversationOptimistically,
  } = options;
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [showDisconnectedBanner, setShowDisconnectedBanner] = useState(false);

  // Use refs to avoid recreating callbacks on every render
  const selectedConversationIdRef = useRef(selectedConversationId);
  const onNewIncomingMessageRef = useRef(onNewIncomingMessage);
  const onMarkSelectedConversationAsReadRef = useRef(onMarkSelectedConversationAsRead);
  const addMessageOptimisticallyRef = useRef(addMessageOptimistically);
  const updateMessageOptimisticallyRef = useRef(updateMessageOptimistically);
  const addConversationOptimisticallyRef = useRef(addConversationOptimistically);
  const updateConversationOptimisticallyRef = useRef(updateConversationOptimistically);

  // Debounce ref for mark as read
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for disconnect delay timer
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for channel to allow force reconnect
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Ref for health check interval
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for last event timestamp (polling fallback)
  const lastEventTimestampRef = useRef<number>(Date.now());
  // Ref for BroadcastChannel (cross-tab sync)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  // Ref for connection status (to avoid stale closure in interval)
  const connectionStatusRef = useRef<'connecting' | 'connected' | 'disconnected'>('connecting');
  // Ref for forceReconnect function
  const forceReconnectRef = useRef<() => void>(() => {});

  // Keep refs in sync
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    onNewIncomingMessageRef.current = onNewIncomingMessage;
  }, [onNewIncomingMessage]);

  useEffect(() => {
    onMarkSelectedConversationAsReadRef.current = onMarkSelectedConversationAsRead;
  }, [onMarkSelectedConversationAsRead]);

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

  // Keep connectionStatusRef in sync
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // Setup BroadcastChannel for cross-tab synchronization
  useEffect(() => {
    // BroadcastChannel is supported in all modern browsers
    if (typeof BroadcastChannel === 'undefined') {
      logger.log('[InboxRealtime] BroadcastChannel not supported');
      return;
    }

    const bc = new BroadcastChannel('capichat-inbox-realtime');
    broadcastChannelRef.current = bc;

    bc.onmessage = (event) => {
      const { type, data } = event.data;
      logger.log('[InboxRealtime] Received from other tab:', type);

      switch (type) {
        case 'NEW_MESSAGE':
          // Apply optimistic update from other tab
          if (addMessageOptimisticallyRef.current) {
            addMessageOptimisticallyRef.current(data);
          }
          // Also update conversations cache
          queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
            if (!old) return old;
            const existingConv = old.find((conv) => conv.id === data.conversation_id);
            if (!existingConv) return old;
            return old.map((conv) =>
              conv.id === data.conversation_id
                ? {
                    ...conv,
                    last_message_at: data.created_at,
                    last_message_content: data.content,
                  }
                : conv
            );
          });
          break;

        case 'MESSAGE_UPDATE':
          if (updateMessageOptimisticallyRef.current) {
            updateMessageOptimisticallyRef.current(data.id, data);
          }
          break;

        case 'CONVERSATION_UPDATE':
          if (updateConversationOptimisticallyRef.current) {
            updateConversationOptimisticallyRef.current(data.id, data);
          }
          queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
            if (!old) return old;
            return old.map((conv) => (conv.id === data.id ? { ...conv, ...data } : conv));
          });
          break;
      }
    };

    return () => {
      bc.close();
      broadcastChannelRef.current = null;
    };
  }, [queryClient]);

  // Broadcast event to other tabs
  const broadcastToOtherTabs = useCallback((type: string, data: any) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type, data });
    }
  }, []);

  // Handle new message in selected conversation - optimistic update
  const handleMessageInsert = useCallback(
    (payload: any) => {
      const newMessage = payload.new as Message;
      const conversationId = newMessage.conversation_id;
      const currentSelectedId = selectedConversationIdRef.current;

      // Update last event timestamp for polling fallback
      lastEventTimestampRef.current = Date.now();

      logger.log('[InboxRealtime] New message:', {
        messageId: newMessage.id,
        conversationId,
        isSelectedConversation: conversationId === currentSelectedId,
      });

      // Broadcast to other tabs
      broadcastToOtherTabs('NEW_MESSAGE', newMessage);

      // Use infinite hook's optimistic update if available (for selected conversation)
      if (conversationId === currentSelectedId && addMessageOptimisticallyRef.current) {
        addMessageOptimisticallyRef.current(newMessage);
      } else {
        // Fallback to old query update for non-infinite queries
        queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
          if (!old) return [newMessage];
          if (old.some((m) => m.id === newMessage.id)) return old;
          return [...old, newMessage];
        });
      }

      // Notify for incoming messages from leads (if not the selected conversation)
      if (
        newMessage.sender_type === 'lead' &&
        conversationId !== currentSelectedId &&
        onNewIncomingMessageRef.current
      ) {
        // Get lead name from conversations cache if available
        const conversations = queryClient.getQueryData<any[]>(['conversations']);
        const conv = conversations?.find((c) => c.id === conversationId);
        const leadName = conv?.leads?.whatsapp_name || conv?.leads?.name;
        onNewIncomingMessageRef.current(newMessage, leadName);
      }

      // Calculate unread increment
      const isFromLead = newMessage.sender_type === 'lead';
      const isSelectedConversation = conversationId === currentSelectedId;
      const isOtherConversation = !isSelectedConversation;

      // AUTO MARK AS READ: If message arrives in the selected conversation while tab is visible
      if (isFromLead && isSelectedConversation && document.visibilityState === 'visible') {
        // Debounce to avoid multiple rapid updates
        if (markAsReadTimeoutRef.current) {
          clearTimeout(markAsReadTimeoutRef.current);
        }
        markAsReadTimeoutRef.current = setTimeout(() => {
          if (onMarkSelectedConversationAsReadRef.current) {
            logger.log('[InboxRealtime] Auto-marking conversation as read:', conversationId);
            onMarkSelectedConversationAsReadRef.current(conversationId);
          }
        }, 300); // 300ms debounce
      }
      const unreadIncrement = isFromLead && isOtherConversation ? 1 : 0;

      // Update conversation in infinite list if function available
      if (updateConversationOptimisticallyRef.current) {
        updateConversationOptimisticallyRef.current(conversationId, {
          last_message_at: newMessage.created_at,
          last_message_content: newMessage.content,
          unread_count_increment: unreadIncrement,
        });
      }

      // BUG-01 FIX: ALWAYS sync the ['conversations'] cache for sidebar badges
      // This cache is used by useSidebarBadges which doesn't use infinite queries
      queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
        if (!old) return old;

        const existingConv = old.find((conv) => conv.id === conversationId);
        if (!existingConv) return old;

        const newUnreadCount = isFromLead
          ? (existingConv.unread_count || 0) + 1
          : existingConv.unread_count;

        // Skip update if nothing changed
        if (
          existingConv.last_message_at === newMessage.created_at &&
          existingConv.last_message_content === newMessage.content &&
          existingConv.unread_count === newUnreadCount
        ) {
          return old;
        }

        return old.map((conv) => {
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
    },
    [queryClient, broadcastToOtherTabs]
  );

  // Handle message updates (status changes, starred, etc.)
  const handleMessageUpdate = useCallback(
    (payload: any) => {
      const updatedMessage = payload.new as Message;
      const oldMessage = payload.old as Message | undefined;
      const conversationId = updatedMessage.conversation_id;
      const currentSelectedId = selectedConversationIdRef.current;

      // Update last event timestamp for polling fallback
      lastEventTimestampRef.current = Date.now();

      if (oldMessage && oldMessage.status !== updatedMessage.status) {
        logger.log('[InboxRealtime] Message status changed:', {
          id: updatedMessage.id,
          oldStatus: oldMessage.status,
          newStatus: updatedMessage.status,
        });
      } else {
        logger.log('[InboxRealtime] Message updated:', updatedMessage.id);
      }

      // Broadcast to other tabs
      broadcastToOtherTabs('MESSAGE_UPDATE', updatedMessage);

      // Use infinite hook's optimistic update if available
      if (conversationId === currentSelectedId && updateMessageOptimisticallyRef.current) {
        updateMessageOptimisticallyRef.current(updatedMessage.id, updatedMessage);
      } else {
        // Fallback to old query update
        queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
          if (!old) return old;
          return old.map((m) => (m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));
        });
      }
    },
    [queryClient, broadcastToOtherTabs]
  );

  // Handle conversation updates
  const handleConversationChange = useCallback(
    (payload: any) => {
      // Update last event timestamp for polling fallback
      lastEventTimestampRef.current = Date.now();

      logger.log('[InboxRealtime] Conversation change:', payload.eventType);
      const currentSelectedId = selectedConversationIdRef.current;

      if (payload.eventType === 'UPDATE') {
        const updated = payload.new;

        // Broadcast to other tabs
        broadcastToOtherTabs('CONVERSATION_UPDATE', updated);

        // Use infinite hook's optimistic update if available
        if (updateConversationOptimisticallyRef.current) {
          updateConversationOptimisticallyRef.current(updated.id, updated);
        }

        // BUG-01 FIX: Also sync ['conversations'] cache for sidebar badges
        queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((conv) => (conv.id === updated.id ? { ...conv, ...updated } : conv));
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
        queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
    [queryClient, broadcastToOtherTabs]
  );

  // Handle lead labels changes (for conversation list labels display)
  // BUG-03 FIX: Only invalidate the specific lead's labels, not all conversations
  const handleLeadLabelsChange = useCallback(
    (payload: any) => {
      const leadId = payload.new?.lead_id || payload.old?.lead_id;
      logger.log('[InboxRealtime] Lead labels change:', payload.eventType, { leadId });

      if (leadId) {
        // Invalidate the labels query for this specific lead (matches useLeadLabels queryKey)
        queryClient.invalidateQueries({ queryKey: ['lead_labels', leadId] });
        // Also invalidate single lead query if loaded
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
        // Invalidate conversations to update labels in list
        queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      }
    },
    [queryClient]
  );

  // Setup subscription with reconnect capability
  const setupChannel = useCallback(() => {
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
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setShowDisconnectedBanner(false);
          // Clear any pending disconnect timeout
          if (disconnectTimeoutRef.current) {
            clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          // Only show banner after 3 seconds of being disconnected
          if (!disconnectTimeoutRef.current) {
            disconnectTimeoutRef.current = setTimeout(() => {
              setShowDisconnectedBanner(true);
            }, 3000);
          }
        } else {
          setConnectionStatus('connecting');
        }
      });

    channelRef.current = channel;
    return channel;
  }, [handleMessageInsert, handleMessageUpdate, handleConversationChange, handleLeadLabelsChange]);

  useEffect(() => {
    const channel = setupChannel();

    // Health check: auto-reconnect every 30s if disconnected
    healthCheckIntervalRef.current = setInterval(() => {
      const currentStatus = connectionStatusRef.current;

      if (currentStatus === 'disconnected') {
        logger.log('[InboxRealtime] Health check: attempting auto-reconnect');
        forceReconnectRef.current();
      }

      // Polling fallback: if no events in 60s, invalidate queries to refresh data
      const timeSinceLastEvent = Date.now() - lastEventTimestampRef.current;
      if (timeSinceLastEvent > 60000 && currentStatus === 'connected') {
        logger.log('[InboxRealtime] Polling fallback: no events in 60s, refreshing data');
        lastEventTimestampRef.current = Date.now(); // Reset to avoid repeated polls
        queryClient.invalidateQueries({ queryKey: ['messages-infinite'] });
        queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      }
    }, 30000);

    return () => {
      logger.log('[InboxRealtime] Cleaning up subscription');
      setConnectionStatus('disconnected');
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
      }
      // BUG FIX: Clear mark as read timeout to prevent memory leak
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
      // Clear health check interval
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, []);

  // Force reconnect function
  const forceReconnect = useCallback(() => {
    logger.log('[InboxRealtime] Force reconnecting...');
    setShowDisconnectedBanner(false);
    setConnectionStatus('connecting');

    // Clear timeout
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    // Remove current channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Setup new channel
    setupChannel();
  }, [setupChannel]);

  // Keep forceReconnectRef in sync
  useEffect(() => {
    forceReconnectRef.current = forceReconnect;
  }, [forceReconnect]);

  return { connectionStatus, showDisconnectedBanner, forceReconnect };
}
