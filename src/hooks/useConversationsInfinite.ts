import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 50;

interface ConversationData {
  id: string;
  status: 'open' | 'pending' | 'resolved';
  last_message_at: string;
  last_message_content: string | null;
  unread_count: number;
  is_favorite: boolean | null;
  assigned_to: string | null;
  created_at: string;
  whatsapp_instance_id: string | null;
  leads: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    temperature: string;
    avatar_url: string | null;
    whatsapp_name: string | null;
    benefit_type: string | null;
    lead_labels: Array<{
      labels: {
        id: string;
        name: string;
        color: string;
        category: string;
      };
    }>;
  };
}

interface ConversationsPage {
  conversations: ConversationData[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Hook para carregar conversas com paginação infinita por cursor.
 * Usa last_message_at como cursor para evitar problemas de offset.
 */
export function useConversationsInfinite() {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['conversations-infinite'],
    queryFn: async ({ pageParam }): Promise<ConversationsPage> => {
      let queryBuilder = supabase
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
        .order('last_message_at', { ascending: false })
        .limit(PAGE_SIZE + 1); // +1 para verificar se há mais

      // Se temos um cursor, buscar conversas com last_message_at ANTES dele
      if (pageParam) {
        queryBuilder = queryBuilder.lt('last_message_at', pageParam);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      const conversations = (data || []) as unknown as ConversationData[];
      const hasMore = conversations.length > PAGE_SIZE;
      
      // Remover item extra usado para verificar hasMore
      const pageConversations = hasMore 
        ? conversations.slice(0, PAGE_SIZE) 
        : conversations;
      
      // O cursor é o last_message_at da conversa mais antiga desta página
      const nextCursor = hasMore && pageConversations.length > 0
        ? pageConversations[pageConversations.length - 1].last_message_at
        : null;

      return {
        conversations: pageConversations,
        nextCursor,
        hasMore,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Flatten todas as páginas em uma única lista
  const allConversations = query.data?.pages
    .flatMap(page => page.conversations)
    // Remover duplicatas por ID
    .filter((conv, index, self) => 
      index === self.findIndex(c => c.id === conv.id)
    )
    ?? [];

  // Função para atualizar uma conversa otimisticamente
  const updateConversationOptimistically = useCallback((
    conversationId: string, 
    updates: Partial<ConversationData>
  ) => {
    queryClient.setQueryData(
      ['conversations-infinite'],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        const newPages = oldData.pages.map(page => ({
          ...page,
          conversations: page.conversations.map(conv => 
            conv.id === conversationId ? { ...conv, ...updates } : conv
          ),
        }));
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient]);

  // Função para adicionar nova conversa no topo
  const addConversationOptimistically = useCallback((newConversation: ConversationData) => {
    queryClient.setQueryData(
      ['conversations-infinite'],
      (oldData: typeof query.data) => {
        if (!oldData) return oldData;
        
        const newPages = [...oldData.pages];
        if (newPages.length > 0) {
          const firstPage = newPages[0];
          // Verificar se já existe
          if (!firstPage.conversations.some(c => c.id === newConversation.id)) {
            newPages[0] = {
              ...firstPage,
              conversations: [newConversation, ...firstPage.conversations],
            };
          }
        }
        
        return { ...oldData, pages: newPages };
      }
    );
  }, [queryClient]);

  return {
    conversations: allConversations,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateConversationOptimistically,
    addConversationOptimistically,
  };
}
