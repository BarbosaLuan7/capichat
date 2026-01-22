import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useDeleteMessages } from '@/hooks/useDeleteMessages';

interface UseMessageSelectionOptions {
  conversationId: string | undefined;
}

interface UseMessageSelectionReturn {
  selectionMode: boolean;
  setSelectionMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedMessages: string[];
  setSelectedMessages: React.Dispatch<React.SetStateAction<string[]>>;
  showDeleteModal: boolean;
  setShowDeleteModal: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSelectMessage: (messageId: string) => void;
  cancelSelection: () => void;
  handleDeleteForMe: () => void;
  handleDeleteForEveryone: () => void;
  isDeletingForMe: boolean;
  isDeletingForEveryone: boolean;
}

export function useMessageSelection({
  conversationId,
}: UseMessageSelectionOptions): UseMessageSelectionReturn {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { deleteForMe, deleteForEveryone, isDeletingForMe, isDeletingForEveryone } =
    useDeleteMessages();

  const toggleSelectMessage = useCallback(
    (messageId: string) => {
      if (!selectionMode) {
        setSelectionMode(true);
      }
      setSelectedMessages((prev) =>
        prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
      );
    },
    [selectionMode]
  );

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages([]);
  }, []);

  const handleDeleteForMe = useCallback(() => {
    if (!conversationId) return;

    // Filtrar IDs temporários (mensagens otimistas ainda não salvas)
    const validMessageIds = selectedMessages.filter((id) => !id.startsWith('temp_'));

    if (validMessageIds.length === 0) {
      toast.warning('Aguarde as mensagens serem enviadas antes de apagar');
      return;
    }

    deleteForMe.mutate(
      { messageIds: validMessageIds, conversationId },
      {
        onSuccess: () => {
          setShowDeleteModal(false);
          cancelSelection();
        },
      }
    );
  }, [conversationId, selectedMessages, deleteForMe, cancelSelection]);

  const handleDeleteForEveryone = useCallback(() => {
    if (!conversationId) return;

    // Filtrar IDs temporários (mensagens otimistas ainda não salvas)
    const validMessageIds = selectedMessages.filter((id) => !id.startsWith('temp_'));

    if (validMessageIds.length === 0) {
      toast.warning('Aguarde as mensagens serem enviadas antes de apagar');
      return;
    }

    deleteForEveryone.mutate(
      { messageIds: validMessageIds, conversationId },
      {
        onSuccess: () => {
          setShowDeleteModal(false);
          cancelSelection();
        },
      }
    );
  }, [conversationId, selectedMessages, deleteForEveryone, cancelSelection]);

  return {
    selectionMode,
    setSelectionMode,
    selectedMessages,
    setSelectedMessages,
    showDeleteModal,
    setShowDeleteModal,
    toggleSelectMessage,
    cancelSelection,
    handleDeleteForMe,
    handleDeleteForEveryone,
    isDeletingForMe,
    isDeletingForEveryone,
  };
}
