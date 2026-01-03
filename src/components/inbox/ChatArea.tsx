import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, Suspense } from 'react';
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
  Zap,
  Upload,
  Copy,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Components - Static imports for critical components
import { AttachmentMenu } from '@/components/inbox/AttachmentMenu';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import { SlashCommandPopover } from '@/components/inbox/SlashCommandPopover';
import { MessageBubble } from '@/components/inbox/MessageBubble';
import { InlineNoteMessage } from '@/components/inbox/InlineNoteMessage';
import { ReplyPreview } from '@/components/inbox/ReplyPreview';
import { ConversationStatusActions } from '@/components/inbox/ConversationStatusActions';
import { DateSeparator } from '@/components/inbox/DateSeparator';
import { ScrollToBottomButton } from '@/components/inbox/ScrollToBottomButton';
import { SelectionBar } from '@/components/inbox/SelectionBar';
import { DeleteMessagesModal } from '@/components/inbox/DeleteMessagesModal';

// Lazy loaded components - loaded on demand
const EmojiPicker = React.lazy(() => import('@/components/inbox/EmojiPicker').then(m => ({ default: m.EmojiPicker })));
const AudioRecorder = React.lazy(() => import('@/components/inbox/AudioRecorder').then(m => ({ default: m.AudioRecorder })));
const AIReminderPrompt = React.lazy(() => import('@/components/inbox/AIReminderPrompt').then(m => ({ default: m.AIReminderPrompt })));

// Hooks
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSignedUrlBatch } from '@/hooks/useSignedUrl';
import { useThrottledCallback } from '@/hooks/useThrottle';

import { useAIReminders } from '@/hooks/useAIReminders';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeleteMessages } from '@/hooks/useDeleteMessages';

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
  onSendMessage: (content: string, type: string, mediaUrl?: string | null, replyToExternalId?: string | null) => Promise<void>;
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

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(
  function ChatArea({
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
  }, ref) {
  const isMobile = useIsMobile();
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'image' | 'video' | 'audio' | 'document' } | null>(null);
  const [showSlashCommand, setShowSlashCommand] = useState(false);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const dragCounter = useRef(0);
  const hasStartedTypingRef = useRef(false);
  
  // Scroll control refs - prevent flicker by ensuring only ONE scroll per conversation opening
  const initialScrollDoneForConversationRef = useRef<string | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);
  const showScrollButtonRef = useRef(false);
  // Hooks
  const { uploadFile, uploadProgress } = useFileUpload();
  const audioRecorder = useAudioRecorder();
  const { deleteForMe, deleteForEveryone, isDeletingForMe, isDeletingForEveryone } = useDeleteMessages();
  
  // Batch resolve signed URLs para todas as mensagens com mídia
  const mediaUrls = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => m.media_url).map(m => m.media_url);
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

  // Auto-scroll to bottom when NEW messages arrive (NOT during conversation opening)
  useEffect(() => {
    if (!messages?.length || !conversation?.id) return;
    
    // GUARD: Don't run during initial scroll phase for this conversation
    const isOpeningConversation = initialScrollDoneForConversationRef.current !== conversation.id;
    if (isOpeningConversation) return;
    
    const lastMessage = messages[messages.length - 1] as ExtendedMessage;
    const isNewMessage = lastMessage.id !== lastMessageIdRef.current;
    
    if (isNewMessage) {
      lastMessageIdRef.current = lastMessage.id;
      
      // Check if this is an optimistic message (just sent by agent)
      const isOptimisticAgentMessage = lastMessage.isOptimistic && lastMessage.sender_type === 'agent';
      
      // Force scroll if:
      // 1. User is near the bottom, OR
      // 2. It's a new message from the lead (response), OR
      // 3. Agent just sent this message (optimistic)
      if (isNearBottomRef.current || lastMessage.sender_type === 'lead' || isOptimisticAgentMessage) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, conversation?.id]);

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
      isNearBottomRef.current = true;
      setShowScrollButton(false);
      showScrollButtonRef.current = false;
    }
  }, [conversation?.id, conversation?.unread_count]);

  // Auto-scroll when conversation changes - RUNS ONLY ONCE per conversation
  useEffect(() => {
    // GUARD: Already scrolled for this conversation
    if (initialScrollDoneForConversationRef.current === conversation?.id) return;
    
    if (!conversation?.id || isLoadingMessages || !messages || messages.length === 0) return;
    
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) {
      // Fallback and mark as done
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      initialScrollDoneForConversationRef.current = conversation.id;
      lastMessageIdRef.current = messages[messages.length - 1]?.id || null;
      return;
    }
    
    const unreadCount = initialUnreadCountRef.current ?? 0;
    
    const scrollToAbsoluteBottom = () => {
      // Force scroll to absolute bottom - use scrollHeight directly
      viewport.scrollTop = viewport.scrollHeight;
      // Also use scrollIntoView as backup
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };
    
    const performScroll = () => {
      if (unreadCount > 0 && messages.length >= unreadCount) {
        // Has unread messages: scroll to first unread message using scrollIntoView
        const firstUnreadIndex = messages.length - unreadCount;
        const messageElements = viewport.querySelectorAll('[data-message-index]');
        const targetElement = messageElements?.[firstUnreadIndex] as HTMLElement;
        
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
          // Adjust for header padding
          viewport.scrollTop = Math.max(0, viewport.scrollTop - 80);
        } else {
          scrollToAbsoluteBottom();
        }
      } else {
        // No unread messages: scroll to absolute bottom
        scrollToAbsoluteBottom();
      }
    };
    
    // Single RAF to ensure DOM is ready, then scroll
    requestAnimationFrame(() => {
      performScroll();
      
      // Mark initial scroll as done and set last message id
      initialScrollDoneForConversationRef.current = conversation.id;
      lastMessageIdRef.current = messages[messages.length - 1]?.id || null;
      
      // For read conversations only: multiple rechecks after images might load
      if (unreadCount === 0) {
        const forceBottomScroll = () => {
          if (initialScrollDoneForConversationRef.current !== conversation.id) return;
          scrollToAbsoluteBottom();
        };
        
        // Multiple rechecks to handle lazy-loaded images
        setTimeout(forceBottomScroll, 100);
        setTimeout(forceBottomScroll, 300);
        setTimeout(forceBottomScroll, 600);
        setTimeout(forceBottomScroll, 1000);
      }
    });
  }, [conversation?.id, isLoadingMessages, messages]);

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

  // Core scroll handler - receives the element directly (not the event)
  const handleMessagesScrollCore = useCallback((element: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Update near bottom state (within 100px of bottom)
    isNearBottomRef.current = distanceFromBottom < 100;
    
    // Only update showScrollButton state if it actually changed (reduce re-renders)
    const shouldShowButton = distanceFromBottom > 200;
    if (showScrollButtonRef.current !== shouldShowButton) {
      showScrollButtonRef.current = shouldShowButton;
      setShowScrollButton(shouldShowButton);
    }
    
    // Load more messages when scrolling near the TOP (older messages)
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages && onLoadMoreMessages) {
      const previousScrollHeight = scrollHeight;
      onLoadMoreMessages();
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newScrollHeight = element.scrollHeight;
          const scrollDelta = newScrollHeight - previousScrollHeight;
          if (scrollDelta > 0) {
            element.scrollTop = scrollTop + scrollDelta;
          }
        });
      });
    }
  }, [hasMoreMessages, isLoadingMoreMessages, onLoadMoreMessages]);

  // Throttled scroll handler
  const throttledScroll = useThrottledCallback(handleMessagesScrollCore, 100);
  
  // Wrapper that extracts currentTarget synchronously before throttling
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element) {
      throttledScroll(element);
    }
  }, [throttledScroll]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
    isNearBottomRef.current = true;
  }, []);

  // Merge messages and notes for inline display
  type MessageItem = Message & { itemType: 'message' };
  type NoteItem = NonNullable<typeof internalNotes>[number] & { itemType: 'note' };
  type CombinedItem = MessageItem | NoteItem;

  const messagesWithNotes = useMemo((): CombinedItem[] => {
    if (!messages) return [];
    
    const messageItems: CombinedItem[] = messages.map(m => ({ ...m, itemType: 'message' as const })) as CombinedItem[];
    
    if (!internalNotes || internalNotes.length === 0) {
      return messageItems;
    }

    const noteItems: CombinedItem[] = internalNotes.map(n => ({ ...n, itemType: 'note' as const })) as CombinedItem[];
    const combined = [...messageItems, ...noteItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return combined;
  }, [messages, internalNotes]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    if (!messagesWithNotes.length) return [];
    
    type GroupedItem = {
      date: Date;
      items: typeof messagesWithNotes;
    };
    
    const groups: GroupedItem[] = [];
    let currentDateKey: string | null = null;
    let currentGroup: typeof messagesWithNotes = [];

    messagesWithNotes.forEach((item) => {
      const itemDate = new Date(item.created_at);
      const dateKey = format(itemDate, 'yyyy-MM-dd');

      if (dateKey !== currentDateKey) {
        if (currentGroup.length > 0) {
          groups.push({ 
            date: new Date(currentGroup[0].created_at), 
            items: currentGroup 
          });
        }
        currentDateKey = dateKey;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ 
        date: new Date(currentGroup[0].created_at), 
        items: currentGroup 
      });
    }

    return groups;
  }, [messagesWithNotes]);

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
      currentInput || '',  // Enviar vazio ao invés de [image], [video], etc.
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

  const handleRetryMessage = useCallback((message: ExtendedMessage) => {
    // Re-enviar a mensagem falha
    onSendMessage(
      message.content || '',
      message.type || 'text',
      message.media_url || null,
      message.reply_to_external_id || null
    );
  }, [onSendMessage]);

  // Selection mode handlers
  const toggleSelectMessage = useCallback((messageId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
    }
    setSelectedMessages(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  }, [selectionMode]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages([]);
  }, []);

  const handleDeleteForMe = useCallback(() => {
    if (!conversation) return;
    
    // Filtrar IDs temporários (mensagens otimistas ainda não salvas)
    const validMessageIds = selectedMessages.filter(id => !id.startsWith('temp_'));
    
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
    const validMessageIds = selectedMessages.filter(id => !id.startsWith('temp_'));
    
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

      await onSendMessage('', 'audio', mediaUrl);  // Enviar vazio ao invés de '[Áudio]'

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
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  }, [setMessageInput, showSlashCommand, onStartTyping]);

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
          const type = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 'document';
          
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
    
    const type = file.type.startsWith('image/') ? 'image' : 
                 file.type.startsWith('video/') ? 'video' : 
                 file.type.startsWith('audio/') ? 'audio' : 'document';
    
    setPendingFile({ file, type });
    toast.success(`Arquivo "${file.name}" pronto para envio`);
  }, []);

  // Empty state
  if (!conversation || !lead) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Selecione uma conversa
          </h3>
          <p className="text-muted-foreground">
            Escolha uma conversa na lista para começar a atender
          </p>
        </div>
      </div>
    );
  }

  const isPhoneAsName = lead.name?.startsWith('Lead ') && /^Lead \d+$/.test(lead.name);
  const chatDisplayName = (lead as any).whatsapp_name || (!isPhoneAsName ? lead.name : null) || formatPhoneNumber(lead.phone);

  return (
    <div 
      ref={ref} 
      className="flex-1 min-w-0 flex flex-col overflow-hidden relative"
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
            className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex items-center justify-center"
          >
            <div className="text-center p-8 bg-card rounded-xl shadow-lg border border-border">
              <Upload className="w-12 h-12 text-primary mx-auto mb-3" />
              <p className="text-lg font-medium text-foreground">
                Solte o arquivo aqui
              </p>
              <p className="text-sm text-muted-foreground">
                Imagens, vídeos, áudios ou documentos
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header */}
      <div className="h-16 px-4 flex items-center gap-3 border-b border-border bg-card">
        {/* Mobile back button */}
        {isMobile && onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0"
            aria-label="Voltar para lista de conversas"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={lead.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`} />
            <AvatarFallback>{chatDisplayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{chatDisplayName}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground truncate">{formatPhoneNumber(lead.phone)}</p>
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
                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ConversationStatusActions
            currentStatus={conversation.status}
            onStatusChange={onStatusChange}
            isLoading={isUpdatingStatus}
          />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggleFavorite}
            aria-label={conversation.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star className={cn(
              "w-4 h-4",
              conversation.is_favorite && "fill-warning text-warning"
            )} />
          </Button>
          <Button
            variant={showLeadPanel ? "secondary" : "ghost"}
            size="icon"
            onClick={onToggleLeadPanel}
            aria-label={showLeadPanel ? "Ocultar detalhes do lead" : "Mostrar detalhes do lead"}
            className={cn(
              "transition-colors",
              !showLeadPanel && "text-primary hover:text-primary hover:bg-primary/10"
            )}
          >
            {showLeadPanel ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden">
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-full p-4 bg-muted/30"
          style={{ willChange: 'scroll-position' }}
          onScrollCapture={handleMessagesScroll}
        >
          <div className="space-y-2 max-w-3xl mx-auto" style={{ willChange: 'contents' }}>
            {/* Loading more indicator at top */}
            {isLoadingMoreMessages && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Carregando mensagens anteriores...</span>
                </div>
              </div>
            )}
            
            {/* Indicator when there are no more old messages */}
            {!isLoadingMoreMessages && !hasMoreMessages && messages && messages.length > 10 && (
              <div className="flex justify-center py-3">
                <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  Início da conversa
                </span>
              </div>
            )}
            
            {isLoadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn("flex gap-2 animate-pulse", i % 2 === 0 && "flex-row-reverse")}>
                    <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                    <div className={cn(
                      "rounded-2xl p-4 max-w-[70%] space-y-2",
                      i % 2 === 0 ? "bg-primary/20" : "bg-card"
                    )}>
                      <div className="h-3 w-32 bg-muted rounded" />
                      <div className="h-3 w-48 bg-muted rounded" />
                      <div className="h-2 w-12 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">
                  Nenhuma mensagem ainda
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-4">
                  Envie a primeira mensagem para iniciar a conversa
                </p>
                <TemplateSelector
                  onSelectTemplate={handleTemplateSelect}
                  leadName={lead.name}
                  leadPhone={lead.phone}
                  leadBenefitType={lead.benefit_type || undefined}
                  agentName={agentName}
                  triggerElement={
                    <Button variant="outline" size="sm" className="gap-2">
                      <Zap className="w-4 h-4" />
                      Usar template de boas-vindas
                    </Button>
                  }
                />
              </div>
            ) : (
              (() => {
                let messageIndex = 0; // Counter only for messages, not notes
                const unreadCount = initialUnreadCountRef.current ?? 0;
                const totalMessages = messages?.length ?? 0;
                const firstUnreadIndex = unreadCount > 0 ? totalMessages - unreadCount : -1;
                
                return groupedMessages.map((group) => (
                  <div key={group.date.toISOString()}>
                    <DateSeparator date={group.date} />
                    
                    <div className="space-y-4">
                      {group.items.map((item, index) => {
                        if (item.itemType === 'note') {
                          return <InlineNoteMessage key={`note-${item.id}`} note={item as any} />;
                        }

                        const message = item as MessageItem;
                        const currentMessageIndex = messageIndex;
                        messageIndex++;
                        
                        const isAgent = message.sender_type === 'agent';
                        const prevItem = group.items[index - 1];
                        const showAvatar = index === 0 || prevItem?.itemType === 'note' || (prevItem as any)?.sender_type !== message.sender_type;

                        // Filter out locally deleted messages
                        if ((message as any).is_deleted_locally) return null;
                        
                        // Check if this is the first unread message
                        const isFirstUnread = currentMessageIndex === firstUnreadIndex;

                        return (
                          <div key={message.id} data-message-index={currentMessageIndex}>
                            {isFirstUnread && (
                              <div className="flex items-center gap-3 py-3 mb-4">
                                <div className="flex-1 h-px bg-primary/40" />
                                <span className="text-xs font-medium text-primary px-2">
                                  Mensagens não lidas
                                </span>
                                <div className="flex-1 h-px bg-primary/40" />
                              </div>
                            )}
                            <MessageBubble
                              message={message as any}
                              isAgent={isAgent}
                              showAvatar={showAvatar}
                              leadName={lead.name}
                              leadAvatarUrl={lead.avatar_url}
                              agentName={agentName}
                              onReply={handleReplyMessage}
                              onRetry={handleRetryMessage}
                              resolvedMediaUrl={message.media_url ? getSignedUrl(message.media_url) : undefined}
                              selectionMode={selectionMode}
                              isSelected={selectedMessages.includes(message.id)}
                              onToggleSelect={toggleSelectMessage}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            )}
            
            {/* Upload progress indicator */}
            {uploadProgress.uploading && (
              <div className="flex gap-2 flex-row-reverse animate-pulse">
                <div className="w-8 h-8 rounded-full bg-primary/30 shrink-0" />
                <div className="rounded-2xl rounded-tr-sm bg-primary/40 p-4 max-w-[70%] space-y-2">
                  <div className="h-3 w-32 bg-primary/30 rounded" />
                  <div className="flex items-center gap-1 justify-end">
                    <Loader2 className="w-3 h-3 animate-spin text-primary-foreground/50" />
                    <span className="text-xs text-primary-foreground/50">Enviando arquivo...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </ScrollArea>
        
        <ScrollToBottomButton
          show={showScrollButton}
          onClick={scrollToBottom}
        />
        
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
        <div className="px-4 py-2 bg-muted/50 border-t border-border">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div className="flex-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Enviando... {uploadProgress.progress}%
            </span>
          </div>
        </div>
      )}

      {/* Pending File Preview */}
      {pendingFile && !uploadProgress.uploading && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            {/* Miniatura da imagem se for imagem */}
            {pendingFile.type === 'image' && (
              <img 
                src={URL.createObjectURL(pendingFile.file)} 
                alt="Preview" 
                className="w-12 h-12 object-cover rounded-lg border border-border"
              />
            )}
            
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-sm text-foreground font-medium truncate">
                {pendingFile.file.name}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
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
        <div className="px-4 py-2 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <Suspense fallback={<div className="py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}>
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
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
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

          <div className="flex-1 relative flex items-end">
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
              placeholder="Digite / para atalhos... (Shift+Enter para nova linha)"
              className="pr-12 resize-none min-h-[40px] max-h-[120px] overflow-y-auto py-2"
              rows={1}
            />
            <div className="absolute right-1 bottom-2">
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
              <Mic className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={(!messageInput.trim() && !pendingFile) || uploadProgress.uploading}
              className="gradient-primary text-primary-foreground min-w-[40px]"
              aria-label={uploadProgress.uploading ? "Enviando..." : "Enviar mensagem"}
            >
              {uploadProgress.uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

ChatArea.displayName = 'ChatArea';
