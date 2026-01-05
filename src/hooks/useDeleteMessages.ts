import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface DeleteForMeParams {
  messageIds: string[];
  conversationId: string;
}

interface DeleteForEveryoneParams {
  messageIds: string[];
  conversationId: string;
}

export function useDeleteMessages() {
  const queryClient = useQueryClient();

  // Soft delete - apenas marca como deletado localmente
  const deleteForMe = useMutation({
    mutationFn: async ({ messageIds, conversationId }: DeleteForMeParams) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted_locally: true })
        .in('id', messageIds);

      if (error) throw error;
      return { messageIds, conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Mensagens apagadas para você');
    },
    onError: (error) => {
      logger.error('[useDeleteMessages] Erro ao apagar localmente:', error);
      toast.error('Erro ao apagar mensagens');
    },
  });

  // Delete para todos - chama edge function para deletar no WhatsApp
  const deleteForEveryone = useMutation({
    mutationFn: async ({ messageIds, conversationId }: DeleteForEveryoneParams) => {
      const { data, error } = await supabase.functions.invoke('delete-whatsapp-message', {
        body: { messageIds, conversationId },
      });

      if (error) throw error;
      return { ...data, messageIds, conversationId };
    },
    onSuccess: ({ conversationId, results }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      
      // Verificar se todas foram deletadas com sucesso
      interface DeleteResult { success: boolean; messageId?: string; error?: string }
      const typedResults = results as DeleteResult[] | undefined;
      const successCount = typedResults?.filter((r) => r.success).length || 0;
      const failCount = typedResults?.filter((r) => !r.success).length || 0;
      
      if (failCount === 0) {
        toast.success('Mensagens apagadas para todos');
      } else if (successCount > 0) {
        toast.warning(`${successCount} mensagens apagadas, ${failCount} falharam`);
      } else {
        toast.error('Erro ao apagar mensagens');
      }
    },
    onError: (error) => {
      logger.error('[useDeleteMessages] Erro ao apagar para todos:', error);
      toast.error('Erro ao apagar mensagens no WhatsApp');
    },
  });

  return {
    deleteForMe,
    deleteForEveryone,
    isDeletingForMe: deleteForMe.isPending,
    isDeletingForEveryone: deleteForEveryone.isPending,
  };
}
