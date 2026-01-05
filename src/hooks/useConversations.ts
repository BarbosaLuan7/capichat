import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionErrors';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export function useConversations() {
  return useQuery({
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
            whatsapp_name,
            benefit_type,
            lead_labels (
              labels (id, name, color, category)
            )
          ),
          whatsapp_config (
            id,
            name,
            phone_number
          )
        `)
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000, // 60 seconds - reduces refetches
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useConversation(id: string | undefined, tenantId?: string | null) {
  return useQuery({
    queryKey: ['conversations', id, tenantId],
    queryFn: async () => {
      if (!id) return null;
      
      let query = supabase
        .from('conversations')
        .select(`
          *,
          leads (id, name, phone, email, temperature, avatar_url, tenant_id)
        `)
        .eq('id', id);
      
      // Add tenant filter if provided to prevent cross-tenant access
      if (tenantId) {
        query = query.eq('leads.tenant_id', tenantId);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    staleTime: 60 * 1000, // 60 segundos
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
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
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    staleTime: 10000, // 10 seconds
  });
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
    mutationFn: async (message: MessageInsert & { reply_to_external_id?: string }) => {
      logger.log('[useSendMessage] Enviando via edge function:', message.conversation_id);

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          conversation_id: message.conversation_id,
          content: message.content,
          type: message.type || 'text',
          media_url: message.media_url,
          reply_to_external_id: message.reply_to_external_id,
        },
      });

      if (error) {
        logger.error('[useSendMessage] Edge function error:', error);
        const friendly = getEdgeFunctionErrorMessage(error);
        throw new Error(friendly || 'Erro ao enviar mensagem');
      }

      if (!data?.success) {
        logger.error('[useSendMessage] API error:', data?.error);
        throw new Error(data?.error || 'Erro ao enviar mensagem via WhatsApp');
      }

      logger.log('[useSendMessage] Mensagem enviada:', data);
      return data.message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      // NÃO mostrar toast aqui - o erro é tratado otimisticamente no Inbox
      logger.error('[useSendMessage] Mutation error:', error);
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
    onMutate: async (conversationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      await queryClient.cancelQueries({ queryKey: ['conversations', conversationId] });
      await queryClient.cancelQueries({ queryKey: ['conversations-infinite'], exact: false });
      
      // Snapshot previous values
      const previousConversations = queryClient.getQueryData(['conversations']);
      const previousConversation = queryClient.getQueryData(['conversations', conversationId]);
      
      // Optimistically update conversation list
      queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map(conv => 
          conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
        );
      });
      
      // Optimistically update single conversation cache
      queryClient.setQueryData(['conversations', conversationId], (old: any) => {
        if (!old) return old;
        return { ...old, unread_count: 0 };
      });
      
      // Also update infinite queries (used by Inbox)
      queryClient.setQueriesData(
        { queryKey: ['conversations-infinite'], exact: false },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              conversations: page.conversations.map((conv: any) =>
                conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
              ),
            })),
          };
        }
      );
      
      return { previousConversations, previousConversation };
    },
    onError: (_, conversationId, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations);
      }
      if (context?.previousConversation) {
        queryClient.setQueryData(['conversations', conversationId], context.previousConversation);
      }
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
    onMutate: async ({ conversationId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previousConversations = queryClient.getQueryData(['conversations']);
      
      queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map(conv => 
          conv.id === conversationId ? { ...conv, is_favorite: isFavorite } : conv
        );
      });
      
      // Also update the single conversation cache
      queryClient.setQueryData(['conversations', conversationId], (old: any) => {
        if (!old) return old;
        return { ...old, is_favorite: isFavorite };
      });
      
      return { previousConversations };
    },
    onError: (_, __, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations);
      }
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
    onMutate: async ({ conversationId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previousConversations = queryClient.getQueryData(['conversations']);
      
      queryClient.setQueryData(['conversations'], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map(conv => 
          conv.id === conversationId ? { ...conv, status } : conv
        );
      });
      
      queryClient.setQueryData(['conversations', conversationId], (old: any) => {
        if (!old) return old;
        return { ...old, status };
      });
      
      return { previousConversations };
    },
    onError: (_, __, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations);
      }
    },
  });
}
