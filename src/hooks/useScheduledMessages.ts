import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledMessage {
  id: string;
  lead_id: string;
  conversation_id: string | null;
  content: string;
  template_id: string | null;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  lead?: {
    id: string;
    name: string;
    phone: string;
  };
}

export function useScheduledMessages(leadId?: string) {
  return useQuery({
    queryKey: ['scheduled-messages', leadId],
    queryFn: async () => {
      let query = supabase
        .from('scheduled_messages')
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .order('scheduled_for', { ascending: true });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ScheduledMessage[];
    },
  });
}

export function usePendingScheduledMessages() {
  return useQuery({
    queryKey: ['scheduled-messages', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      return (data || []) as ScheduledMessage[];
    },
  });
}

export function useCreateScheduledMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (message: {
      lead_id: string;
      conversation_id?: string;
      content: string;
      template_id?: string;
      scheduled_for: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert({
          ...message,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({ title: 'Mensagem agendada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao agendar mensagem', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({ title: 'Mensagem cancelada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cancelar mensagem', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateScheduledMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, content, scheduled_for }: { id: string; content?: string; scheduled_for?: string }) => {
      const updateData: any = {};
      if (content !== undefined) updateData.content = content;
      if (scheduled_for !== undefined) updateData.scheduled_for = scheduled_for;

      const { data, error } = await supabase
        .from('scheduled_messages')
        .update(updateData)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({ title: 'Mensagem atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar mensagem', description: error.message, variant: 'destructive' });
    },
  });
}
