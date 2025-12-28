import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './useDebounce';

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

// Debounce time for sending our typing status (3 seconds)
const SEND_TYPING_DEBOUNCE_MS = 3000;

export function useTypingIndicator({ conversationId, leadPhone }: UseTypingIndicatorOptions) {
  const [typingStates, setTypingStates] = useState<TypingState>({});
  const [isSendingTyping, setIsSendingTyping] = useState(false);
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastTypingSentRef = useRef<number>(0);

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
          setTypingStates(prev => ({
            ...prev,
            [incomingConvId]: {
              isTyping: true,
              phone: phone || '',
              lastUpdate: Date.now(),
            },
          }));
          
          // Set timeout to clear typing indicator
          timeoutRef.current[incomingConvId] = setTimeout(() => {
            setTypingStates(prev => {
              const { [incomingConvId]: _, ...rest } = prev;
              return rest;
            });
          }, TYPING_TIMEOUT_MS);
        } else {
          // 'paused', 'online', 'offline' - clear typing
          setTypingStates(prev => {
            const { [incomingConvId]: _, ...rest } = prev;
            return rest;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clear all timeouts
      Object.values(timeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // Get typing status for current conversation
  const isLeadTyping = conversationId ? typingStates[conversationId]?.isTyping || false : false;
  const typingPhone = conversationId ? typingStates[conversationId]?.phone : undefined;

  // Function to send our typing status
  const sendTypingStatus = useCallback(async (status: 'typing' | 'paused') => {
    if (!conversationId) return;
    
    // Throttle: don't send more than once every 3 seconds for 'typing'
    if (status === 'typing') {
      const now = Date.now();
      if (now - lastTypingSentRef.current < SEND_TYPING_DEBOUNCE_MS) {
        return;
      }
      lastTypingSentRef.current = now;
    }

    try {
      setIsSendingTyping(true);
      const { error } = await supabase.functions.invoke('send-typing-status', {
        body: { conversationId, status },
      });
      
      if (error) {
        console.error('[useTypingIndicator] Error sending typing status:', error);
      }
    } catch (err) {
      console.error('[useTypingIndicator] Failed to send typing status:', err);
    } finally {
      setIsSendingTyping(false);
    }
  }, [conversationId]);

  // Debounced version for use while typing
  const debouncedSendPaused = useDebounce(() => {
    sendTypingStatus('paused');
  }, SEND_TYPING_DEBOUNCE_MS);

  // Called when user starts typing
  const onUserTyping = useCallback(() => {
    sendTypingStatus('typing');
  }, [sendTypingStatus]);

  // Called when user stops typing (blur, send message, etc.)
  const onUserStoppedTyping = useCallback(() => {
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
