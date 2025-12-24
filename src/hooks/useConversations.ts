import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionErrors';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          leads (
            id, 
            name, 
            phone, 
            email, 
            temperature,
            avatar_url,
            lead_labels (
              labels (id, name, color, category)
            )
          )
        `)
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Set up realtime subscription for conversations and messages
  useEffect(() => {
    console.log('[Realtime] Subscribing to conversations');

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('[Realtime] Conversation change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[Realtime] New message in any conversation:', payload);
          // Invalidate conversations to update last_message_at and unread_count
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Inbox subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from inbox');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          leads (id, name, phone, email, temperature, avatar_url)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: 10000, // Fallback: refetch every 10s
  });

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!conversationId) return;

    console.log('[Realtime] Subscribing to messages for conversation:', conversationId);

    const channel = supabase
      .channel(`messages-realtime-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[Realtime] New message received:', payload);
          // Optimistic update: add message directly to cache
          queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
            if (!old) return [payload.new as Message];
            // Avoid duplicates
            if (old.some(m => m.id === (payload.new as Message).id)) return old;
            return [...old, payload.new as Message];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[Realtime] Message updated:', payload);
          queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
            if (!old) return old;
            return old.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m);
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Messages subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from messages:', conversationId);
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversation: ConversationInsert) => {
      const { data, error } = await supabase
        .from('conversations')
        .insert(conversation)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: MessageInsert) => {
      console.log('[useSendMessage] Enviando via edge function:', message.conversation_id);

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          conversation_id: message.conversation_id,
          content: message.content,
          type: message.type || 'text',
          media_url: message.media_url,
        },
      });

      if (error) {
        console.error('[useSendMessage] Edge function error:', error);
        const friendly = getEdgeFunctionErrorMessage(error);
        throw new Error(friendly || 'Erro ao enviar mensagem');
      }

      if (!data?.success) {
        console.error('[useSendMessage] API error:', data?.error);
        throw new Error(data?.error || 'Erro ao enviar mensagem via WhatsApp');
      }

      console.log('[useSendMessage] Mensagem enviada:', data);
      return data.message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error('[useSendMessage] Mutation error:', error);
    },
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useToggleConversationFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, isFavorite }: { conversationId: string; isFavorite: boolean }) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({ is_favorite: isFavorite })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateConversationAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, assignedTo }: { conversationId: string; assignedTo: string }) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({ assigned_to: assignedTo })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useToggleMessageStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const { data, error } = await supabase
        .from('messages')
        .update({ is_starred: isStarred })
        .eq('id', messageId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all messages queries
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: 'open' | 'pending' | 'resolved' }) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({ status })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
