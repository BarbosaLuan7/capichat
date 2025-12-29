import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];

const PAGE_SIZE = 50;

interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Extended message type for optimistic updates
// Note: 'sending' and 'failed' are client-only statuses not in the DB enum
export interface OptimisticMessage {
  id: string;
  conversation_id: string;
  content: string;
  sender_type: 'agent' | 'lead';
  type: string;
  status: string; // 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  created_at: string;
  isOptimistic?: boolean;
  errorMessage?: string;
  // Optional fields to match Message type
  sender_id?: string | null;
  media_url?: string | null;
  is_starred?: boolean | null;
  direction?: 'inbound' | 'outbound' | null;
  is_internal_note?: boolean | null;
  lead_id?: string | null;
  external_id?: string | null;
  reply_to_external_id?: string | null;
  quoted_message?: any;
  source?: string | null;
}

/**
 * Hook para carregar mensagens com paginação infinita (scroll para cima).
 * Carrega as últimas 50 mensagens inicialmente, e mais ao scroll.
 */
export function useMessagesInfinite(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['messages-infinite', conversationId],
    queryFn: async ({ pageParam }): Promise<MessagesPage> => {
      if (!conversationId) {
        return { messages: [], nextCursor: null, hasMore: false };
      }

      let queryBuilder = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1); // +1 para verificar se há mais

      // Se temos um cursor, buscar mensagens ANTES dele (mais antigas)
      if (pageParam) {
        queryBuilder = queryBuilder.lt('created_at', pageParam);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      const messages = data || [];
      const hasMore = messages.length > PAGE_SIZE;
      
      // Remover item extra usado para verificar hasMore
      const pageMessages = hasMore ? messages.slice(0, PAGE_SIZE) : messages;
      
      // O cursor é o created_at da mensagem mais antiga desta página
      const nextCursor = hasMore && pageMessages.length > 0
        ? pageMessages[pageMessages.length - 1].created_at
        : null;

      // Inverter para ordem cronológica (mais antigas primeiro)
      return {
        messages: pageMessages.reverse(),
        nextCursor,
        hasMore,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    staleTime: 30000, // 30 seconds - optimized for performance
  });

  // Flatten todas as páginas em uma única lista de mensagens
  const allMessages = query.data?.pages
    .flatMap(page => page.messages)
    // Remover duplicatas por ID (pode acontecer com realtime)
    .filter((msg, index, self) => 
      index === self.findIndex(m => m.id === msg.id)
    )
    // Ordenar por data (mais antigas primeiro)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    ?? [];

  // Função para adicionar nova mensagem otimisticamente (realtime)
  const addMessageOptimistically = useCallback((newMessage: Message | OptimisticMessage) => {
    queryClient.setQueryData(
      ['messages-infinite', conversationId],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        // Adicionar na primeira página (mensagens mais recentes)
        const newPages = [...oldData.pages];
        if (newPages.length > 0) {
          const firstPage = newPages[0];
          // Verificar se já existe
          if (!firstPage.messages.some(m => m.id === newMessage.id)) {
            newPages[0] = {
              ...firstPage,
              messages: [...firstPage.messages, newMessage as Message],
            };
          }
        }
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient, conversationId]);

  // Função para atualizar uma mensagem existente
  const updateMessageOptimistically = useCallback((messageId: string, updates: Partial<Message>) => {
    queryClient.setQueryData(
      ['messages-infinite', conversationId],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        const newPages = oldData.pages.map(page => ({
          ...page,
          messages: page.messages.map(msg => 
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        }));
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient, conversationId]);

  // Função para substituir mensagem otimista pela real (quando API retorna)
  const replaceOptimisticMessage = useCallback((tempId: string, realMessage: Message) => {
    queryClient.setQueryData(
      ['messages-infinite', conversationId],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        const newPages = oldData.pages.map(page => ({
          ...page,
          messages: page.messages.map(msg => 
            msg.id === tempId ? { ...realMessage, isOptimistic: false } : msg
          ),
        }));
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient, conversationId]);

  // Função para marcar mensagem como falha
  const markMessageFailed = useCallback((tempId: string, errorMessage?: string) => {
    queryClient.setQueryData(
      ['messages-infinite', conversationId],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        const newPages = oldData.pages.map(page => ({
          ...page,
          messages: page.messages.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const, errorMessage } 
              : msg
          ),
        }));
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient, conversationId]);

  // Função para remover mensagem (ex: após reenvio bem-sucedido)
  const removeMessage = useCallback((messageId: string) => {
    queryClient.setQueryData(
      ['messages-infinite', conversationId],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        const newPages = oldData.pages.map(page => ({
          ...page,
          messages: page.messages.filter(msg => msg.id !== messageId),
        }));
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient, conversationId]);

  return {
    messages: allMessages,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
    error: query.error,
    addMessageOptimistically,
    updateMessageOptimistically,
    replaceOptimisticMessage,
    markMessageFailed,
    removeMessage,
  };
}
