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
    staleTime: 10000, // 10 seconds
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
  const addMessageOptimistically = useCallback((newMessage: Message) => {
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
              messages: [...firstPage.messages, newMessage],
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
  };
}
