import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  Suspense,
} from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Context
import { useInbox } from '@/contexts/InboxContext';

// Components
import { ReplyPreview } from '@/components/inbox/ReplyPreview';
import { ScrollToBottomButton } from '@/components/inbox/ScrollToBottomButton';
import { SelectionBar } from '@/components/inbox/SelectionBar';
import { DeleteMessagesModal } from '@/components/inbox/DeleteMessagesModal';
import {
  VirtualizedMessageList,
  VirtualizedMessageListRef,
} from '@/components/inbox/VirtualizedMessageList';
import { ChatHeader } from '@/components/inbox/ChatHeader';
import { MessageInputFooter } from '@/components/inbox/MessageInputFooter';
import { UploadIndicator } from '@/components/inbox/UploadIndicator';
import { FilePreviewBanner } from '@/components/inbox/FilePreviewBanner';
import { DropZoneOverlay } from '@/components/inbox/DropZoneOverlay';
import { AudioRecorderSection } from '@/components/inbox/AudioRecorderSection';
import { EmptyConversationState } from '@/components/inbox/EmptyConversationState';

// Lazy loaded
const AIReminderPrompt = React.lazy(() =>
  import('@/components/inbox/AIReminderPrompt').then((m) => ({ default: m.AIReminderPrompt }))
);

// Hooks
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useSignedUrlBatch } from '@/hooks/useSignedUrl';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSyncChatHistory } from '@/hooks/useSyncChatHistory';
import { useSendMessage, type PendingFile } from '@/hooks/useSendMessage';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { useMessageInput } from '@/hooks/useMessageInput';
import { useMessageSelection } from '@/hooks/useMessageSelection';

import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];

interface ChatAreaProps {
  className?: string;
  onBack?: () => void;
  onStartTyping?: () => void;
  onMessageSent?: () => void;
}

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(function ChatArea(props, ref) {
  const { className, onBack, onStartTyping, onMessageSent } = props;

  // Get data from context
  const {
    selectedConversation: conversation,
    lead,
    messages,
    isLoadingMessages,
    isLoadingMoreMessages,
    isUpdatingStatus,
    hasMoreMessages,
    fetchMoreMessages,
    onSendMessage,
    onStatusChange,
    onToggleFavorite,
    showLeadPanel,
    setShowLeadPanel,
    agentName,
  } = useInbox();

  const isMobile = useIsMobile();
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Refs
  const virtualizerRef = useRef<VirtualizedMessageListRef>(null);
  const initialUnreadCountRef = useRef<number | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);

  // Hooks
  const audioRecorder = useAudioRecorder();
  const { uploadFile } = useFileUpload();
  const { mutate: syncHistory, isPending: isSyncing } = useSyncChatHistory();
  const { data: internalNotes } = useInternalNotes(conversation?.id || undefined);

  const {
    handleSendMessage: sendMessage,
    handleRetryMessage,
    uploadProgress,
    aiReminders,
    showReminderPrompt,
    setShowReminderPrompt,
  } = useSendMessage({
    conversationId: conversation?.id,
    leadName: lead?.name,
    onSendMessage,
    onMessageSent,
  });

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } =
    useDragAndDrop((file) => setPendingFile(file));

  const {
    selectionMode,
    selectedMessages,
    showDeleteModal,
    setShowDeleteModal,
    toggleSelectMessage,
    cancelSelection,
    handleDeleteForEveryone,
    isDeletingForMe,
    isDeletingForEveryone,
  } = useMessageSelection({ conversationId: conversation?.id });

  const mediaUrls = useMemo(() => {
    if (!messages) return [];
    return messages.filter((m) => m.media_url).map((m) => m.media_url);
  }, [messages]);
  const { getSignedUrl } = useSignedUrlBatch(mediaUrls);

  // Send handler
  const handleSend = useCallback(() => {
    sendMessage(messageInput, replyingTo, pendingFile, {
      clearInput: () => setMessageInput(''),
      clearReply: () => setReplyingTo(null),
      clearPendingFile: () => setPendingFile(null),
      focusInput: () => inputRef.current?.focus(),
    });
  }, []);

  const {
    messageInput,
    setMessageInput,
    showSlashCommand,
    setShowSlashCommand,
    inputRef,
    handleInputChange,
    handleKeyDown,
    handlePaste,
    handleEmojiSelect,
    handleTemplateSelect,
    focusInput,
  } = useMessageInput({
    onStartTyping,
    onSendMessage: handleSend,
    isUploading: uploadProgress.uploading,
    onFileSelect: setPendingFile,
  });

  // Updated send with latest state
  const handleSendFinal = useCallback(() => {
    sendMessage(messageInput, replyingTo, pendingFile, {
      clearInput: () => setMessageInput(''),
      clearReply: () => setReplyingTo(null),
      clearPendingFile: () => setPendingFile(null),
      focusInput: () => inputRef.current?.focus(),
    });
  }, [sendMessage, messageInput, replyingTo, pendingFile, setMessageInput, inputRef]);

  // Reset scroll state on conversation change
  useEffect(() => {
    if (conversation?.id && conversation.id !== lastConversationIdRef.current) {
      lastConversationIdRef.current = conversation.id;
      initialUnreadCountRef.current = conversation.unread_count ?? 0;
      setShowScrollButton(false);
    }
  }, [conversation?.id, conversation?.unread_count]);

  // Auto-focus on desktop
  useEffect(() => {
    if (conversation?.id && !isMobile && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [conversation?.id, isMobile, inputRef]);

  // ESC to cancel selection mode
  useEffect(() => {
    if (!selectionMode) return;

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelSelection();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [selectionMode, cancelSelection]);

  const scrollToBottom = useCallback(() => {
    virtualizerRef.current?.scrollToBottom();
    setShowScrollButton(false);
  }, []);

  const handleReplyMessage = useCallback(
    (message: Message) => {
      setReplyingTo(message);
      inputRef.current?.focus();
    },
    [inputRef]
  );

  const handleFileSelect = useCallback(
    (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
      setPendingFile({ file, type });
      toast.info(`Arquivo selecionado: ${file.name}`);
    },
    []
  );

  const handleAudioSend = useCallback(async () => {
    if (!audioRecorder.audioBlob || !conversation) return;
    try {
      const file = new File([audioRecorder.audioBlob], 'audio.webm', { type: 'audio/webm' });
      const mediaUrl = await uploadFile(file, 'audio');
      await onSendMessage('', 'audio', mediaUrl);
      audioRecorder.cancelRecording();
      setShowAudioRecorder(false);
      toast.success('Audio enviado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar audio');
    }
  }, [audioRecorder, conversation, onSendMessage, uploadFile]);

  const handleToggleLeadPanel = useCallback(() => {
    setShowLeadPanel(!showLeadPanel);
  }, [showLeadPanel, setShowLeadPanel]);

  // Empty state
  if (!conversation || !lead) return <EmptyConversationState />;

  return (
    <div
      ref={ref}
      className={`relative flex min-w-0 flex-1 flex-col overflow-hidden ${className || ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AnimatePresence>{isDragging && <DropZoneOverlay />}</AnimatePresence>

      <ChatHeader
        lead={lead}
        conversationStatus={conversation.status}
        isFavorite={conversation.is_favorite ?? false}
        showLeadPanel={showLeadPanel}
        isMobile={isMobile}
        isSyncing={isSyncing}
        isUpdatingStatus={isUpdatingStatus}
        onBack={onBack}
        onStatusChange={onStatusChange}
        onToggleFavorite={onToggleFavorite}
        onSyncHistory={() => syncHistory(conversation.id)}
        onToggleLeadPanel={handleToggleLeadPanel}
      />

      <div className="relative flex-1 overflow-hidden">
        <VirtualizedMessageList
          key={conversation?.id}
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
          onLoadMoreMessages={fetchMoreMessages}
          getSignedUrl={getSignedUrl}
          onTemplateSelect={handleTemplateSelect}
          onInitialScrollDone={() => {}}
          uploadProgress={uploadProgress}
        />

        <ScrollToBottomButton show={showScrollButton} onClick={scrollToBottom} />

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

        <DeleteMessagesModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          selectedCount={selectedMessages.length}
          onDeleteForEveryone={handleDeleteForEveryone}
          isDeletingForEveryone={isDeletingForEveryone}
        />
      </div>

      {uploadProgress.uploading && <UploadIndicator progress={uploadProgress.progress} />}

      {pendingFile && !uploadProgress.uploading && (
        <FilePreviewBanner pendingFile={pendingFile} onCancel={() => setPendingFile(null)} />
      )}

      {showAudioRecorder && (
        <AudioRecorderSection
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
      )}

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

      <MessageInputFooter
        messageInput={messageInput}
        showSlashCommand={showSlashCommand}
        showAudioRecorder={showAudioRecorder}
        pendingFile={pendingFile}
        isUploading={uploadProgress.uploading}
        inputRef={inputRef}
        lead={lead}
        agentName={agentName}
        onInputChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onEmojiSelect={handleEmojiSelect}
        onTemplateSelect={handleTemplateSelect}
        onFileSelect={handleFileSelect}
        onAudioRecordStart={() => {
          setShowAudioRecorder(true);
          audioRecorder.startRecording();
        }}
        onSendMessage={handleSendFinal}
        onCloseSlashCommand={() => setShowSlashCommand(false)}
      />
    </div>
  );
});

ChatArea.displayName = 'ChatArea';
