import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MessageSearchResult {
  messageId: string;
  conversationId: string;
  content: string;
  createdAt: string;
  leadName: string;
  leadPhone: string;
}

export function useMessageSearch(searchTerm: string, enabled = true) {
  return useQuery({
    queryKey: ['message-search', searchTerm],
    queryFn: async (): Promise<MessageSearchResult[]> => {
      if (!searchTerm || searchTerm.length < 3) return [];

      // Search messages containing the term
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          conversation_id,
          created_at,
          conversations!inner (
            id,
            leads (
              name,
              phone
            )
          )
        `)
        .ilike('content', `%${searchTerm}%`)
        .eq('type', 'text')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error searching messages:', error);
        throw error;
      }

      // Transform results
      return (messages || []).map((msg: any) => ({
        messageId: msg.id,
        conversationId: msg.conversation_id,
        content: msg.content,
        createdAt: msg.created_at,
        leadName: msg.conversations?.leads?.name || 'Lead',
        leadPhone: msg.conversations?.leads?.phone || '',
      }));
    },
    enabled: enabled && searchTerm.length >= 3,
    staleTime: 60000, // 1 minute
  });
}
