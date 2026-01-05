import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useInternalNotes(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['internal-notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      // Fetch notes
      const { data: notes, error } = await supabase
        .from('internal_notes')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!notes || notes.length === 0) return [];
      
      // Fetch profiles for authors
      const authorIds = [...new Set(notes.map(n => n.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar')
        .in('id', authorIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return notes.map(note => ({
        ...note,
        profiles: profileMap.get(note.author_id) || null
      }));
    },
    enabled: !!conversationId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`internal-notes-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_notes',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-notes', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useCreateInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('internal_notes')
        .insert({
          conversation_id: conversationId,
          author_id: user.id,
          content,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Register activity in lead_activities for history tab
      const { data: conversation } = await supabase
        .from('conversations')
        .select('lead_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (conversation?.lead_id) {
        await supabase.from('lead_activities').insert({
          lead_id: conversation.lead_id,
          user_id: user.id,
          action: 'note_added',
          details: { content: content.substring(0, 100) }
        });
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
    },
  });
}

export function useUpdateInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const { data, error } = await supabase
        .from('internal_notes')
        .update({ content })
        .eq('id', noteId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes'] });
    },
  });
}

export function useDeleteInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('internal_notes')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes'] });
    },
  });
}
