import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  Suspense,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Send,
  MessageSquare,
  Star,
  Mic,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
  Upload,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LeadAvatar } from '@/components/ui/lead-avatar';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { toast } from 'sonner';

// Components - Static imports for critical components
import { AttachmentMenu } from '@/components/inbox/AttachmentMenu';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import { SlashCommandPopover } from '@/components/inbox/SlashCommandPopover';
import { ReplyPreview } from '@/components/inbox/ReplyPreview';
import { ConversationStatusActions } from '@/components/inbox/ConversationStatusActions';
import { ScrollToBottomButton } from '@/components/inbox/ScrollToBottomButton';
import { SelectionBar } from '@/components/inbox/SelectionBar';
import { DeleteMessagesModal } from '@/components/inbox/DeleteMessagesModal';
import {
  VirtualizedMessageList,
  VirtualizedMessageListRef,
} from '@/components/inbox/VirtualizedMessageList';

// Lazy loaded components - loaded on demand
const EmojiPicker = React.lazy(() =>
  import('@/components/inbox/EmojiPicker').then((m) => ({ default: m.EmojiPicker }))
);
const AudioRecorder = React.lazy(() =>
  import('@/components/inbox/AudioRecorder').then((m) => ({ default: m.AudioRecorder }))
);
const AIReminderPrompt = React.lazy(() =>
  import('@/components/inbox/AIReminderPrompt').then((m) => ({ default: m.AIReminderPrompt }))
);

// Hooks
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSignedUrlBatch } from '@/hooks/useSignedUrl';

import { useAIReminders } from '@/hooks/useAIReminders';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeleteMessages } from '@/hooks/useDeleteMessages';
import { useSyncChatHistory } from '@/hooks/useSyncChatHistory';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];
type Message = Database['public']['Tables']['messages']['Row'];

interface LeadWithLabels {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  temperature?: string;
  avatar_url?: string | null;
  whatsapp_name?: string | null;
  benefit_type?: string | null;
  funnel_stages?: { name: string } | null;
  labels?: Array<{ id: string; name: string; color: string }>;
}

interface ConversationData {
  id: string;
  status: ConversationStatus;
  is_favorite?: boolean | null;
  lead_id: string;
  unread_count?: number;
}

interface ChatAreaProps {
  conversation: ConversationData | null;
  lead: LeadWithLabels | null;
  messages: Message[] | undefined;
  isLoadingMessages: boolean;
  onSendMessage: (
    content: string,
    type: string,
    mediaUrl?: string | null,
    replyToExternalId?: string | null
  ) => Promise<void>;
  onStatusChange: (status: ConversationStatus) => void;
  onToggleFavorite: () => void;
  isUpdatingStatus: boolean;
  showLeadPanel: boolean;
  onToggleLeadPanel: () => void;
  agentName?: string;
  onBack?: () => void;
  // Infinite scroll props
  hasMoreMessages?: boolean;
  onLoadMoreMessages?: () => void;
  isLoadingMoreMessages?: boolean;
  // Callback para marcar como lido ao começar a digitar (apenas atribuídos)
  onStartTyping?: () => void;
  // Callback para marcar como lido ao enviar mensagem (apenas não atribuídos)
  onMessageSent?: () => void;
}

type ExtendedMessage = Message & { isOptimistic?: boolean; errorMessage?: string };

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(function ChatArea(
  {
    conversation,
    lead,
    messages,
    isLoadingMessages,
    onSendMessage,
    onStatusChange,
    onToggleFavorite,
    isUpdatingStatus,
    showLeadPanel,
    onToggleLeadPanel,
    agentName,
    onBack,
    hasMoreMessages,
    onLoadMoreMessages,
    isLoadingMoreMessages,
    onStartTyping,
    onMessageSent,
  },
  ref
) {
  const isMobile = useIsMobile();
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    type: 'image' | 'video' | 'audio' | 'document';
  } | null>(null);
  const [showSlashCommand, setShowSlashCommand] = useState(false);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const hasStartedTypingRef = useRef(false);

  // Scroll control refs
  const initialScrollDoneForConversationRef = useRef<string | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Hooks
  const { uploadFile, uploadProgress } = useFileUpload();
  const audioRecorder = useAudioRecorder();
  const { deleteForMe, deleteForEveryone, isDeletingForMe, isDeletingForEveryone } =
    useDeleteMessages();
  const { mutate: syncHistory, isPending: isSyncing } = useSyncChatHistory();

  // Batch resolve signed URLs para todas as mensagens com mídia
  const mediaUrls = useMemo(() => {
    if (!messages) return [];
    return messages.filter((m) => m.media_url).map((m) => m.media_url);
  }, [messages]);
  const { getSignedUrl } = useSignedUrlBatch(mediaUrls);

  const aiReminders = useAIReminders();
  const { data: internalNotes } = useInternalNotes(conversation?.id || undefined);

  // Simple local state for message input (no persistence)
  const [messageInput, setMessageInput] = useState('');

  // Auto-resize textarea based on content (throttled via useEffect instead of onInput)
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    // Reset height to auto to get proper scrollHeight
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [messageInput]);

  // Track initial unread count when conversation changes
  const initialUnreadCountRef = useRef<number | null>(null);

  // Reset scroll state when conversation changes
  useEffect(() => {
    if (conversation?.id && conversation.id !== lastConversationIdRef.current) {
      // New conversation - reset all scroll control flags
      lastConversationIdRef.current = conversation.id;
      initialScrollDoneForConversationRef.current = null;
      initialUnreadCountRef.current = conversation.unread_count ?? 0;
      lastMessageIdRef.current = null;
      setShowScrollButton(false);
    }
  }, [conversation?.id, conversation?.unread_count]);

  // Auto-focus textarea when conversation changes (desktop only)
  useEffect(() => {
    if (conversation?.id && !isMobile && inputRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [conversation?.id, isMobile]);

  // Reset typing flag when conversation changes
  useEffect(() => {
    hasStartedTypingRef.current = false;
  }, [conversation?.id]);

  // Ref to access virtualizer from VirtualizedMessageList
  const virtualizerRef = useRef<VirtualizedMessageListRef>(null);

  // Scroll to bottom (used by ScrollToBottomButton)
  const scrollToBottom = useCallback(() => {
    virtualizerRef.current?.scrollToBottom();
    setShowScrollButton(false);
  }, []);

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !pendingFile) || !conversation) return;

    const sentMessage = messageInput;
    const currentReplyTo = replyingTo;

    // 1. LIMPAR IMEDIATAMENTE - UX instantânea
    const currentInput = messageInput;
    const currentPendingFile = pendingFile;
    setMessageInput('');
    setReplyingTo(null);
    setPendingFile(null);
    inputRef.current?.focus();

    // 2. Preparar dados da mensagem
    let mediaUrl: string | null = null;
    let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';

    // Se tem arquivo, fazer upload primeiro (isso ainda precisa esperar)
    if (currentPendingFile) {
      try {
        mediaUrl = await uploadFile(currentPendingFile.file);
        messageType = currentPendingFile.type;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao fazer upload';
        toast.error(message);
        // Restaurar input se upload falhar
        setMessageInput(currentInput);
        return;
      }
    }

    // 3. Enviar mensagem (agora é otimista - não bloqueia)
    const replyToExternalId = currentReplyTo?.external_id || null;
    onSendMessage(
      currentInput || '', // Enviar vazio ao invés de [image], [video], etc.
      messageType,
      mediaUrl,
      replyToExternalId
    );

    // 4. Marcar como lido ao enviar (para conversas não atribuídas)
    onMessageSent?.();

    // 5. Check for reminders (em background)
    if (sentMessage.trim().length > 10) {
      aiReminders.detectReminder(sentMessage, lead?.name).then((reminderResult) => {
        if (reminderResult?.hasReminder) {
          setShowReminderPrompt(true);
        }
      });
    }
  };

  const handleReplyMessage = useCallback((message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  }, []);

  const handleRetryMessage = useCallback(
    (message: ExtendedMessage) => {
      // Re-enviar a mensagem falha
      onSendMessage(
        message.content || '',
        message.type || 'text',
        message.media_url || null,
        message.reply_to_external_id || null
      );
    },
    [onSendMessage]
  );

  // Selection mode handlers
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
    if (!conversation) return;

    // Filtrar IDs temporários (mensagens otimistas ainda não salvas)
    const validMessageIds = selectedMessages.filter((id) => !id.startsWith('temp_'));

    if (validMessageIds.length === 0) {
      toast.warning('Aguarde as mensagens serem enviadas antes de apagar');
      return;
    }

    deleteForMe.mutate(
      { messageIds: validMessageIds, conversationId: conversation.id },
      {
        onSuccess: () => {
          setShowDeleteModal(false);
          cancelSelection();
        },
      }
    );
  }, [conversation, selectedMessages, deleteForMe, cancelSelection]);

  const handleDeleteForEveryone = useCallback(() => {
    if (!conversation) return;

    // Filtrar IDs temporários (mensagens otimistas ainda não salvas)
    const validMessageIds = selectedMessages.filter((id) => !id.startsWith('temp_'));

    if (validMessageIds.length === 0) {
      toast.warning('Aguarde as mensagens serem enviadas antes de apagar');
      return;
    }

    deleteForEveryone.mutate(
      { messageIds: validMessageIds, conversationId: conversation.id },
      {
        onSuccess: () => {
          setShowDeleteModal(false);
          cancelSelection();
        },
      }
    );
  }, [conversation, selectedMessages, deleteForEveryone, cancelSelection]);

  const handleFileSelect = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    setPendingFile({ file, type });
    toast.info(`Arquivo selecionado: ${file.name}`);
  };

  const handleAudioSend = async () => {
    if (!audioRecorder.audioBlob || !conversation) return;

    try {
      const file = new File([audioRecorder.audioBlob], 'audio.webm', { type: 'audio/webm' });
      const mediaUrl = await uploadFile(file, 'audio');

      await onSendMessage('', 'audio', mediaUrl); // Enviar vazio ao invés de '[Áudio]'

      audioRecorder.cancelRecording();
      setShowAudioRecorder(false);
      toast.success('Áudio enviado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar áudio';
      toast.error(message);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(messageInput + emoji);
    inputRef.current?.focus();
  };

  const handleTemplateSelect = (content: string) => {
    setMessageInput(content);
    setShowSlashCommand(false);
    inputRef.current?.focus();
  };

  // Optimized input change - avoid unnecessary state updates
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessageInput(value);

      // Only update slash command state if it actually changed
      const hasSlash = value.includes('/');
      if (hasSlash !== showSlashCommand) {
        setShowSlashCommand(hasSlash);
      }

      // Marcar como lido na primeira digitação
      if (value.length > 0 && !hasStartedTypingRef.current && onStartTyping) {
        hasStartedTypingRef.current = true;
        onStartTyping();
      }
    },
    [setMessageInput, showSlashCommand, onStartTyping]
  );

  // Handle paste - suporte a colar imagens da área de transferência
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Verificar se é uma imagem
      if (item.type.startsWith('image/')) {
        e.preventDefault();

        const file = item.getAsFile();
        if (file) {
          setPendingFile({ file, type: 'image' });
          toast.info('Imagem colada da área de transferência');
        }
        return;
      }

      // Suportar arquivos copiados
      if (item.kind === 'file') {
        e.preventDefault();

        const file = item.getAsFile();
        if (file) {
          const type = file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('video/')
              ? 'video'
              : file.type.startsWith('audio/')
                ? 'audio'
                : 'document';

          setPendingFile({ file, type: type as 'image' | 'video' | 'audio' | 'document' });
          toast.info(`Arquivo colado: ${file.name}`);
        }
        return;
      }
    }
  }, []);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];

    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'document';

    setPendingFile({ file, type });
    toast.success(`Arquivo "${file.name}" pronto para envio`);
  }, []);

  // Empty state
  if (!conversation || !lead) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">Selecione uma conversa</h3>
          <p className="text-muted-foreground">
            Escolha uma conversa na lista para começar a atender
          </p>
        </div>
      </div>
    );
  }

  const isPhoneAsName = lead.name?.startsWith('Lead ') && /^Lead \d+$/.test(lead.name || '');
  const chatDisplayName =
    (lead as any).whatsapp_name ||
    (!isPhoneAsName ? lead.name : null) ||
    formatPhoneNumber(lead.phone);

  return (
    <div
      ref={ref}
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop Zone Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm"
          >
            <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg">
              <Upload className="mx-auto mb-3 h-12 w-12 text-primary" />
              <p className="text-lg font-medium text-foreground">Solte o arquivo aqui</p>
              <p className="text-sm text-muted-foreground">Imagens, vídeos, áudios ou documentos</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-4">
        {/* Mobile back button */}
        {isMobile && onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0"
            aria-label="Voltar para lista de conversas"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <LeadAvatar lead={lead} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{chatDisplayName}</p>
            <div className="flex items-center gap-1">
              <p className="truncate text-xs text-muted-foreground">
                {formatPhoneNumber(lead.phone)}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(formatPhoneNumber(lead.phone));
                  toast.success('Telefone copiado!', { duration: 1500 });
                }}
                aria-label="Copiar telefone"
              >
                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ConversationStatusActions
            currentStatus={conversation.status}
            onStatusChange={onStatusChange}
            isLoading={isUpdatingStatus}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            aria-label={
              conversation.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
            }
          >
            <Star
              className={cn('h-4 w-4', conversation.is_favorite && 'fill-warning text-warning')}
            />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncHistory(conversation.id)}
                  disabled={isSyncing}
                  aria-label="Sincronizar histórico do WhatsApp"
                >
                  <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sincronizar histórico do WhatsApp</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant={showLeadPanel ? 'secondary' : 'ghost'}
            size="icon"
            onClick={onToggleLeadPanel}
            aria-label={showLeadPanel ? 'Ocultar detalhes do lead' : 'Mostrar detalhes do lead'}
            className={cn(
              'transition-colors',
              !showLeadPanel && 'text-primary hover:bg-primary/10 hover:text-primary'
            )}
          >
            {showLeadPanel ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages - Virtualized */}
      <div className="relative flex-1 overflow-hidden">
        <VirtualizedMessageList
          ref={virtualizerRef}
          messages={messages || []}
          internalNotes={internalNotes}
          initialUnreadCount={initialUnreadCountRef.current ?? 0}
          lead={{
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            avatar_url: lead.avatar_url,
            benefit_type: lead.benefit_type,
          }}
          agentName={agentName}
          onReply={handleReplyMessage}
          onRetry={handleRetryMessage}
          selectionMode={selectionMode}
          selectedMessages={selectedMessages}
          onToggleSelect={toggleSelectMessage}
          isLoadingMessages={isLoadingMessages}
          isLoadingMoreMessages={isLoadingMoreMessages}
          hasMoreMessages={hasMoreMessages}
          onLoadMoreMessages={onLoadMoreMessages}
          getSignedUrl={getSignedUrl}
          onTemplateSelect={handleTemplateSelect}
          onInitialScrollDone={() => {
            initialScrollDoneForConversationRef.current = conversation.id;
            lastMessageIdRef.current = messages?.[messages.length - 1]?.id || null;
          }}
          uploadProgress={uploadProgress}
        />

        <ScrollToBottomButton show={showScrollButton} onClick={scrollToBottom} />

        {/* Selection Bar */}
        <AnimatePresence>
          {selectionMode && (
            <SelectionBar
              selectedCount={selectedMessages.length}
              onCancel={cancelSelection}
              onDelete={() => setShowDeleteModal(true)}
              isDeleting={isDeletingForMe || isDeletingForEveryone}
            />
          )}
        </AnimatePresence>

        {/* Delete Messages Modal */}
        <DeleteMessagesModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          selectedCount={selectedMessages.length}
          onDeleteForEveryone={handleDeleteForEveryone}
          isDeletingForEveryone={isDeletingForEveryone}
        />
      </div>

      {/* Upload Progress Indicator */}
      {uploadProgress.uploading && (
        <div className="border-t border-border bg-muted/50 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              Enviando... {uploadProgress.progress}%
            </span>
          </div>
        </div>
      )}

      {/* Pending File Preview */}
      {pendingFile && !uploadProgress.uploading && (
        <div className="border-t border-border bg-muted/50 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            {/* Miniatura da imagem se for imagem */}
            {pendingFile.type === 'image' && (
              <img
                src={URL.createObjectURL(pendingFile.file)}
                alt="Preview"
                className="h-12 w-12 rounded-lg border border-border object-cover"
              />
            )}

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {pendingFile.file.name}
              </span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                ({(pendingFile.file.size / 1024).toFixed(1)} KB)
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingFile(null)}
              className="shrink-0"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Audio Recorder */}
      {showAudioRecorder && (
        <div className="border-t border-border px-4 py-2">
          <div className="mx-auto max-w-3xl">
            <Suspense
              fallback={
                <div className="py-4">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              }
            >
              <AudioRecorder
                isRecording={audioRecorder.isRecording}
                duration={audioRecorder.duration}
                audioUrl={audioRecorder.audioUrl}
                formatDuration={audioRecorder.formatDuration}
                onStart={audioRecorder.startRecording}
                onStop={audioRecorder.stopRecording}
                onCancel={() => {
                  audioRecorder.cancelRecording();
                  setShowAudioRecorder(false);
                }}
                onSend={handleAudioSend}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* AI Reminder Prompt */}
      <Suspense fallback={null}>
        <AIReminderPrompt
          show={showReminderPrompt}
          reminder={aiReminders.reminder}
          isLoading={aiReminders.isLoading}
          leadId={lead?.id}
          onClose={() => {
            setShowReminderPrompt(false);
            aiReminders.clearReminder();
          }}
        />
      </Suspense>

      {/* Reply Preview - shown when replying to a message */}
      {replyingTo && (
        <ReplyPreview
          message={{
            id: replyingTo.id,
            external_id: replyingTo.external_id,
            content: replyingTo.content,
            sender_type: replyingTo.sender_type as 'lead' | 'agent',
            type: replyingTo.type,
          }}
          leadName={lead.name}
          agentName={agentName}
          onCancel={() => setReplyingTo(null)}
        />
      )}

      {/* Message Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="flex items-center gap-1">
            <AttachmentMenu
              onFileSelect={handleFileSelect}
              onAudioRecordStart={() => {
                setShowAudioRecorder(true);
                audioRecorder.startRecording();
              }}
            />
            <TemplateSelector
              onSelectTemplate={handleTemplateSelect}
              leadName={lead.name}
              leadPhone={lead.phone}
              leadBenefitType={lead.benefit_type || undefined}
              agentName={agentName}
            />
          </div>

          <div className="relative flex flex-1 items-end">
            {showSlashCommand && (
              <SlashCommandPopover
                inputValue={messageInput}
                onSelectTemplate={handleTemplateSelect}
                leadName={lead.name}
                leadPhone={lead.phone}
                leadBenefitType={lead.benefit_type || undefined}
                agentName={agentName}
                inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
                onClose={() => setShowSlashCommand(false)}
              />
            )}
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={messageInput}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (showSlashCommand) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Prevent double-send during upload
                  if (!uploadProgress.uploading) {
                    handleSendMessage();
                  }
                }
              }}
              aria-label="Escrever mensagem"
              placeholder="Digite / para atalhos... (Shift+Enter para nova linha)"
              className="max-h-[120px] min-h-[40px] resize-none overflow-y-auto py-2 pr-12"
              rows={1}
            />
            <div className="absolute bottom-2 right-1">
              <Suspense fallback={null}>
                <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              </Suspense>
            </div>
          </div>

          {!showAudioRecorder && !messageInput.trim() && !pendingFile ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => {
                setShowAudioRecorder(true);
                audioRecorder.startRecording();
              }}
              aria-label="Gravar áudio"
            >
              <Mic className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={(!messageInput.trim() && !pendingFile) || uploadProgress.uploading}
              className="gradient-primary min-w-[40px] text-primary-foreground"
              aria-label={uploadProgress.uploading ? 'Enviando...' : 'Enviar mensagem'}
            >
              {uploadProgress.uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

ChatArea.displayName = 'ChatArea';
