import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PendingFile } from '@/hooks/useSendMessage';

interface UseMessageInputOptions {
  onStartTyping?: () => void;
  onSendMessage: () => void;
  isUploading: boolean;
  onFileSelect?: (file: PendingFile) => void;
}

interface UseMessageInputReturn {
  messageInput: string;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  showSlashCommand: boolean;
  setShowSlashCommand: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleEmojiSelect: (emoji: string) => void;
  handleTemplateSelect: (content: string) => void;
  focusInput: () => void;
  resetTypingFlag: () => void;
}

function getFileType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

export function useMessageInput({
  onStartTyping,
  onSendMessage,
  isUploading,
  onFileSelect,
}: UseMessageInputOptions): UseMessageInputReturn {
  const [messageInput, setMessageInput] = useState('');
  const [showSlashCommand, setShowSlashCommand] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasStartedTypingRef = useRef(false);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [messageInput]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const resetTypingFlag = useCallback(() => {
    hasStartedTypingRef.current = false;
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessageInput(value);

      const hasSlash = value.includes('/');
      if (hasSlash !== showSlashCommand) {
        setShowSlashCommand(hasSlash);
      }

      if (value.length > 0 && !hasStartedTypingRef.current && onStartTyping) {
        hasStartedTypingRef.current = true;
        onStartTyping();
      }
    },
    [showSlashCommand, onStartTyping]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSlashCommand) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isUploading) {
          onSendMessage();
        }
      }
    },
    [showSlashCommand, isUploading, onSendMessage]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!onFileSelect) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            onFileSelect({ file, type: 'image' });
            toast.info('Imagem colada da area de transferencia');
          }
          return;
        }

        if (item.kind === 'file') {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            onFileSelect({ file, type: getFileType(file.type) });
            toast.info(`Arquivo colado: ${file.name}`);
          }
          return;
        }
      }
    },
    [onFileSelect]
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const handleTemplateSelect = useCallback((content: string) => {
    setMessageInput(content);
    setShowSlashCommand(false);
    inputRef.current?.focus();
  }, []);

  return {
    messageInput,
    setMessageInput,
    showSlashCommand,
    setShowSlashCommand,
    inputRef: inputRef as React.RefObject<HTMLTextAreaElement>,
    handleInputChange,
    handleKeyDown,
    handlePaste,
    handleEmojiSelect,
    handleTemplateSelect,
    focusInput,
    resetTypingFlag,
  };
}
