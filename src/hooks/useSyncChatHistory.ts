import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  total: number;
  errors?: string[];
}

export function useSyncChatHistory() {
  return useMutation({
    mutationFn: async (conversationId: string): Promise<SyncResult> => {
      logger.log('[useSyncChatHistory] Sincronizando histórico para:', conversationId);
      
      const { data, error } = await supabase.functions.invoke('sync-chat-history', {
        body: { conversation_id: conversationId, limit: 100 },
      });

      if (error) {
        logger.error('[useSyncChatHistory] Erro:', error);
        throw new Error(error.message || 'Erro ao sincronizar histórico');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao sincronizar histórico');
      }

      return data as SyncResult;
    },
    onSuccess: (data) => {
      if (data.synced > 0) {
        toast.success(`${data.synced} mensagens sincronizadas do WhatsApp`);
        logger.log('[useSyncChatHistory] Sync concluído:', data);
      }
    },
    onError: (error) => {
      logger.error('[useSyncChatHistory] Erro na mutação:', error);
      // Não mostrar toast de erro para não incomodar o usuário
      // O sync é um processo silencioso de background
    },
  });
}
