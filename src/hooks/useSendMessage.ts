import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAIReminders } from '@/hooks/useAIReminders';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];
type ExtendedMessage = Message & { isOptimistic?: boolean; errorMessage?: string };

export interface PendingFile {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface UseSendMessageOptions {
  conversationId: string | undefined;
  leadName?: string | null;
  onSendMessage: (
    content: string,
    type: string,
    mediaUrl?: string | null,
    replyToExternalId?: string | null
  ) => Promise<void>;
  onMessageSent?: () => void;
}

interface UseSendMessageReturn {
  handleSendMessage: (
    messageInput: string,
    replyingTo: Message | null,
    pendingFile: PendingFile | null,
    callbacks: {
      clearInput: () => void;
      clearReply: () => void;
      clearPendingFile: () => void;
      focusInput: () => void;
    }
  ) => Promise<void>;
  handleRetryMessage: (message: ExtendedMessage) => void;
  uploadProgress: { uploading: boolean; progress: number };
  aiReminders: ReturnType<typeof useAIReminders>;
  showReminderPrompt: boolean;
  setShowReminderPrompt: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useSendMessage({
  conversationId,
  leadName,
  onSendMessage,
  onMessageSent,
}: UseSendMessageOptions): UseSendMessageReturn {
  const { uploadFile, uploadProgress } = useFileUpload();
  const aiReminders = useAIReminders();
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);

  const handleSendMessage = useCallback(
    async (
      messageInput: string,
      replyingTo: Message | null,
      pendingFile: PendingFile | null,
      callbacks: {
        clearInput: () => void;
        clearReply: () => void;
        clearPendingFile: () => void;
        focusInput: () => void;
      }
    ) => {
      if ((!messageInput.trim() && !pendingFile) || !conversationId) return;

      const sentMessage = messageInput;

      // 1. Limpar imediatamente - UX instantânea
      callbacks.clearInput();
      callbacks.clearReply();
      callbacks.clearPendingFile();
      callbacks.focusInput();

      // 2. Preparar dados da mensagem
      let mediaUrl: string | null = null;
      let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';

      // Se tem arquivo, fazer upload primeiro
      if (pendingFile) {
        try {
          mediaUrl = await uploadFile(pendingFile.file);
          messageType = pendingFile.type;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro ao fazer upload';
          toast.error(message);
          return;
        }
      }

      // 3. Enviar mensagem (otimista - não bloqueia)
      const replyToExternalId = replyingTo?.external_id || null;
      onSendMessage(messageInput || '', messageType, mediaUrl, replyToExternalId);

      // 4. Marcar como lido ao enviar
      onMessageSent?.();

      // 5. Verificar lembretes (em background)
      if (sentMessage.trim().length > 10) {
        aiReminders.detectReminder(sentMessage, leadName || undefined).then((reminderResult) => {
          if (reminderResult?.hasReminder) {
            setShowReminderPrompt(true);
          }
        });
      }
    },
    [conversationId, onSendMessage, onMessageSent, uploadFile, aiReminders, leadName]
  );

  const handleRetryMessage = useCallback(
    (message: ExtendedMessage) => {
      onSendMessage(
        message.content || '',
        message.type || 'text',
        message.media_url || null,
        message.reply_to_external_id || null
      );
    },
    [onSendMessage]
  );

  return {
    handleSendMessage,
    handleRetryMessage,
    uploadProgress,
    aiReminders,
    showReminderPrompt,
    setShowReminderPrompt,
  };
}
