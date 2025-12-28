import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingState {
  [conversationId: string]: {
    isTyping: boolean;
    phone: string;
    lastUpdate: number;
  };
}

interface UseTypingIndicatorOptions {
  conversationId?: string;
  leadPhone?: string;
}

// Timeout to clear typing indicator if no update received (8 seconds)
const TYPING_TIMEOUT_MS = 8000;

// Idle time to send "paused" after last keypress
const IDLE_TO_PAUSED_MS = 3000;

export function useTypingIndicator({ conversationId }: UseTypingIndicatorOptions) {
  const [typingStates, setTypingStates] = useState<TypingState>({});
  const [isSendingTyping, setIsSendingTyping] = useState(false);
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const lastTypingSentRef = useRef<number>(0);
  const hasSentTypingRef = useRef<boolean>(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to typing status broadcasts
  useEffect(() => {
    const channel = supabase
      .channel('typing-status')
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { conversationId: incomingConvId, phone, status } = payload.payload || {};

        if (!incomingConvId) return;

        console.log('[useTypingIndicator] Received typing event:', { incomingConvId, phone, status });

        // Clear existing timeout for this conversation
        if (timeoutRef.current[incomingConvId]) {
          clearTimeout(timeoutRef.current[incomingConvId]);
        }

        if (status === 'typing') {
          setTypingStates((prev) => ({
            ...prev,
            [incomingConvId]: {
              isTyping: true,
              phone: phone || '',
              lastUpdate: Date.now(),
            },
          }));

          // Set timeout to clear typing indicator
          timeoutRef.current[incomingConvId] = setTimeout(() => {
            setTypingStates((prev) => {
              const { [incomingConvId]: _, ...rest } = prev;
              return rest;
            });
          }, TYPING_TIMEOUT_MS);
        } else {
          // 'paused', 'online', 'offline' - clear typing
          setTypingStates((prev) => {
            const { [incomingConvId]: _, ...rest } = prev;
            return rest;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(timeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // Get typing status for current conversation
  const isLeadTyping = conversationId ? typingStates[conversationId]?.isTyping || false : false;
  const typingPhone = conversationId ? typingStates[conversationId]?.phone : undefined;

  const sendTypingStatus = useCallback(
    async (status: 'typing' | 'paused') => {
      if (!conversationId) return;

      // Avoid spamming paused when we never sent typing
      if (status === 'paused' && !hasSentTypingRef.current) return;

      // Throttle typing sends (max 1 per 3s)
      if (status === 'typing') {
        const now = Date.now();
        if (now - lastTypingSentRef.current < IDLE_TO_PAUSED_MS) {
          return;
        }
        lastTypingSentRef.current = now;
        hasSentTypingRef.current = true;
      }

      try {
        setIsSendingTyping(true);
        const { error } = await supabase.functions.invoke('send-typing-status', {
          body: { conversationId, status },
        });

        if (error) {
          console.error('[useTypingIndicator] Error sending typing status:', error);
        }

        if (status === 'paused') {
          hasSentTypingRef.current = false;
        }
      } catch (err) {
        console.error('[useTypingIndicator] Failed to send typing status:', err);
      } finally {
        setIsSendingTyping(false);
      }
    },
    [conversationId]
  );

  const onUserTyping = useCallback(() => {
    sendTypingStatus('typing');

    // Reset idle timer that will send paused after user stops typing
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      sendTypingStatus('paused');
    }, IDLE_TO_PAUSED_MS);
  }, [sendTypingStatus]);

  const onUserStoppedTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    sendTypingStatus('paused');
  }, [sendTypingStatus]);

  return {
    isLeadTyping,
    typingPhone,
    isSendingTyping,
    onUserTyping,
    onUserStoppedTyping,
    sendTypingStatus,
  };
}
