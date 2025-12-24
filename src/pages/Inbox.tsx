import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  MoreVertical,
  Phone,
  Send,
  Check,
  CheckCheck,
  MessageSquare,
  Star,
  Mic,
  Tag,
  X,
  Loader2,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
  Menu,
  ArrowUpDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { format, isSameDay, isYesterday, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Format conversation date intelligently
const formatConversationDate = (date: Date): string => {
  const now = new Date();
  const diffMins = differenceInMinutes(now, date);
  const diffHours = differenceInHours(now, date);
  const diffDays = differenceInDays(now, date);
  
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (isSameDay(date, now)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'ontem';
  if (diffDays < 7) return format(date, 'EEEE', { locale: ptBR });
  return format(date, 'dd/MM');
};
import { toast } from 'sonner';

// Hooks
import {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useMarkConversationAsRead,
  useToggleConversationFavorite,
  useUpdateConversationAssignee,
  useToggleMessageStar,
  useUpdateConversationStatus,
} from '@/hooks/useConversations';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useLabels, useLeadLabels } from '@/hooks/useLabels';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useAIReminders } from '@/hooks/useAIReminders';
import { useIsMobile } from '@/hooks/use-mobile';

// Components
import { AttachmentMenu } from '@/components/inbox/AttachmentMenu';
import { AudioRecorder } from '@/components/inbox/AudioRecorder';
import { EmojiPicker } from '@/components/inbox/EmojiPicker';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import { SlashCommandPopover } from '@/components/inbox/SlashCommandPopover';
import { MessageBubble } from '@/components/inbox/MessageBubble';
import { LeadDetailsPanel } from '@/components/inbox/LeadDetailsPanel';
import { InlineNoteMessage } from '@/components/inbox/InlineNoteMessage';
import { AISuggestions } from '@/components/inbox/AISuggestions';
import { AIReminderPrompt } from '@/components/inbox/AIReminderPrompt';
import { ConversationStatusTabs } from '@/components/inbox/ConversationStatusTabs';
import { ConversationStatusActions } from '@/components/inbox/ConversationStatusActions';
import { NewConversationModal } from '@/components/inbox/NewConversationModal';
import { ConversationSkeleton, MessageSkeleton, LeadDetailsPanelSkeleton } from '@/components/ui/skeleton';
import { DateSeparator } from '@/components/inbox/DateSeparator';
import { ScrollToBottomButton } from '@/components/inbox/ScrollToBottomButton';
import { LabelBadges } from '@/components/inbox/LabelBadges';
import { MobileBottomNav } from '@/components/inbox/MobileBottomNav';

import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];
type StatusFilter = ConversationStatus | 'all';
type InboxFilter = 'novos' | 'meus' | 'outros';

const Inbox = () => {
  const { user, authUser } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('meus');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'image' | 'video' | 'audio' | 'document' } | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [showSlashCommand, setShowSlashCommand] = useState(false);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const LEAD_PANEL_STORAGE_KEY = 'inbox-show-lead-panel-v2';
  const [showLeadPanel, setShowLeadPanel] = useState(() => {
    const saved = localStorage.getItem(LEAD_PANEL_STORAGE_KEY);
    return saved === 'true';
  });
  
  // Persist lead panel toggle
  useEffect(() => {
    localStorage.setItem(LEAD_PANEL_STORAGE_KEY, String(showLeadPanel));
  }, [showLeadPanel]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const ignoreScrollRef = useRef(false);
  const isMobile = useIsMobile();

  // Data hooks
  const { data: conversations, isLoading: loadingConversations } = useConversations();
  const { data: selectedConversation } = useConversation(selectedConversationId || undefined);
  const { data: messages, isLoading: loadingMessages } = useMessages(selectedConversationId || undefined);
  const { data: leadData, refetch: refetchLead, isLoading: loadingLead } = useLead(selectedConversation?.lead_id || undefined);
  const { data: leadLabels } = useLeadLabels(selectedConversation?.lead_id || undefined);
  const { data: allLabels } = useLabels();
  const { data: internalNotes, isLoading: isNotesLoading } = useInternalNotes(selectedConversationId || undefined);
  
  // Mutations
  const sendMessage = useSendMessage();
  const markAsRead = useMarkConversationAsRead();
  const toggleFavorite = useToggleConversationFavorite();
  const updateAssignee = useUpdateConversationAssignee();
  const toggleMessageStar = useToggleMessageStar();
  const updateLead = useUpdateLead();
  const updateConversationStatus = useUpdateConversationStatus();
  
  // File upload
  const { uploadFile, uploadProgress, getFileType } = useFileUpload();
  
  // Audio recorder
  const audioRecorder = useAudioRecorder();
  
  // AI hooks
  const aiSuggestions = useAISuggestions();
  const aiReminders = useAIReminders();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showScrollButton]);

  // Auto-scroll to bottom when conversation changes and messages are loaded
  useEffect(() => {
    if (selectedConversationId && !loadingMessages && messages && messages.length > 0) {
      // Ignore scroll events during auto-scroll
      ignoreScrollRef.current = true;
      setShowScrollButton(false);
      
      // Use double requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Find the scroll viewport and scroll to bottom
          const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }
          
          // Re-enable scroll detection after a short delay
          setTimeout(() => {
            ignoreScrollRef.current = false;
          }, 300);
        });
      });
    }
  }, [selectedConversationId, loadingMessages, messages?.length]);

  // Handle scroll to detect if user scrolled up
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // Ignore scroll events during auto-scroll
    if (ignoreScrollRef.current) return;
    
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  }, []);

  // Mark as read when selecting conversation - só executar quando MUDAR a conversa selecionada
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unread_count && selectedConversation.unread_count > 0) {
      markAsRead.mutate(selectedConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  // Fetch AI suggestions when conversation changes
  useEffect(() => {
    if (messages && messages.length > 0 && leadWithLabels) {
      aiSuggestions.fetchSuggestions(
        messages.slice(-10),
        {
          name: leadWithLabels.name,
          stage: leadWithLabels.funnel_stages?.name,
          temperature: leadWithLabels.temperature,
          labels: leadWithLabels.labels,
        }
      );
    }
  }, [selectedConversationId, messages?.length]);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = { all: 0, open: 0, pending: 0, resolved: 0 };
    conversations?.forEach((conv) => {
      counts.all++;
      if (conv.status === 'open') counts.open++;
      else if (conv.status === 'pending') counts.pending++;
      else if (conv.status === 'resolved') counts.resolved++;
    });
    return counts;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations?.filter((conv) => {
      // Filter by status tab
      if (statusFilter !== 'all' && conv.status !== statusFilter) {
        return false;
      }

      // Filter by assignment tab
      let matchesFilter = true;
      if (filter === 'novos') {
        const isRecent = new Date(conv.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
        matchesFilter = !conv.assigned_to || isRecent;
      } else if (filter === 'meus') {
        matchesFilter = conv.assigned_to === user?.id;
      } else if (filter === 'outros') {
        matchesFilter = !!conv.assigned_to && conv.assigned_to !== user?.id;
      }
      
      const matchesSearch = !searchQuery || 
        (conv.leads as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.leads as any)?.phone?.includes(searchQuery);

      // Filter by labels
      const matchesLabels = selectedLabelIds.length === 0 || 
        selectedLabelIds.some((labelId) => 
          (conv.leads as any)?.lead_labels?.some((ll: any) => ll.labels?.id === labelId)
        );

      return matchesFilter && matchesSearch && matchesLabels;
    }) || [];

    // Sort by date
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.last_message_at).getTime();
      const dateB = new Date(b.last_message_at).getTime();
      return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [conversations, statusFilter, filter, user?.id, searchQuery, selectedLabelIds, sortOrder]);

  const toggleLabelFilter = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const clearLabelFilters = () => {
    setSelectedLabelIds([]);
  };

  // Group labels by category
  const labelsByCategory = allLabels?.reduce((acc, label) => {
    const category = label.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(label);
    return acc;
  }, {} as Record<string, typeof allLabels>) || {};

  const categoryLabels: Record<string, string> = {
    origem: 'Origem',
    interesse: 'Benefício/Condição',
    prioridade: 'Prioridade',
    status: 'Status',
    beneficio: 'Benefício',
    condicao_saude: 'Condição de Saúde',
    desqualificacao: 'Desqualificação',
    situacao: 'Situação',
    perda: 'Motivo de Perda',
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    // Em mobile, não fechamos automaticamente o painel de lead
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !pendingFile) || !selectedConversationId || !user) return;

    const sentMessage = messageInput;
    
    try {
      let mediaUrl: string | null = null;
      let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';

      if (pendingFile) {
        mediaUrl = await uploadFile(pendingFile.file);
        messageType = pendingFile.type;
        setPendingFile(null);
      }

      await sendMessage.mutateAsync({
        conversation_id: selectedConversationId,
        sender_id: user.id,
        sender_type: 'agent',
        content: messageInput || (messageType !== 'text' ? `[${messageType}]` : ''),
        type: messageType,
        media_url: mediaUrl,
      });

      setMessageInput('');
      inputRef.current?.focus();
      
      // Check for reminders in sent message
      if (sentMessage.trim().length > 10) {
        const reminderResult = await aiReminders.detectReminder(sentMessage, leadWithLabels?.name);
        if (reminderResult?.hasReminder) {
          setShowReminderPrompt(true);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      toast.error(message);
    }
  };

  const handleFileSelect = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    setPendingFile({ file, type });
    toast.info(`Arquivo selecionado: ${file.name}`);
  };

  const handleAudioSend = async () => {
    if (!audioRecorder.audioBlob || !selectedConversationId || !user) return;

    try {
      const file = new File([audioRecorder.audioBlob], 'audio.webm', { type: 'audio/webm' });
      const mediaUrl = await uploadFile(file, 'audio');

      await sendMessage.mutateAsync({
        conversation_id: selectedConversationId,
        sender_id: user.id,
        sender_type: 'agent',
        content: '[Áudio]',
        type: 'audio',
        media_url: mediaUrl,
      });

      audioRecorder.cancelRecording();
      setShowAudioRecorder(false);
      toast.success('Áudio enviado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar áudio';
      toast.error(message);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleTemplateSelect = (content: string) => {
    setMessageInput(content);
    setShowSlashCommand(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);
    // Show slash command popover when "/" is typed
    setShowSlashCommand(value.includes('/'));
  };
  
  const handleSelectAISuggestion = (text: string) => {
    setMessageInput(text);
    inputRef.current?.focus();
  };
  
  const handleRefreshAISuggestions = () => {
    if (messages && messages.length > 0 && leadWithLabels) {
      aiSuggestions.fetchSuggestions(
        messages.slice(-10),
        {
          name: leadWithLabels.name,
          stage: leadWithLabels.funnel_stages?.name,
          temperature: leadWithLabels.temperature,
          labels: leadWithLabels.labels,
        }
      );
    }
  };

  // Merge messages and notes for inline display
  type MessageItem = (typeof messages extends (infer U)[] | undefined ? U : never) & { itemType: 'message' };
  type NoteItem = (typeof internalNotes extends (infer U)[] | undefined ? U : never) & { itemType: 'note' };
  type CombinedItem = MessageItem | NoteItem;

  const messagesWithNotes = useMemo((): CombinedItem[] => {
    if (!messages) return [];
    
    const messageItems: CombinedItem[] = messages.map(m => ({ ...m, itemType: 'message' as const })) as CombinedItem[];
    
    if (!internalNotes || internalNotes.length === 0) {
      return messageItems;
    }

    // Combine and sort by created_at
    const noteItems: CombinedItem[] = internalNotes.map(n => ({ ...n, itemType: 'note' as const })) as CombinedItem[];
    const combined = [...messageItems, ...noteItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return combined;
  }, [messages, internalNotes]);

  // Group messages by date (using original message date to preserve timezone)
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
          // Use the first message's original date to preserve timezone
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

    // Push last group using original date
    if (currentGroup.length > 0) {
      groups.push({ 
        date: new Date(currentGroup[0].created_at), 
        items: currentGroup 
      });
    }

    return groups;
  }, [messagesWithNotes]);

  const handleToggleFavorite = () => {
    if (!selectedConversationId || !selectedConversation) return;
    toggleFavorite.mutate({
      conversationId: selectedConversationId,
      isFavorite: !(selectedConversation as any).is_favorite,
    });
  };

  const handleTransfer = async (userId: string) => {
    if (!selectedConversationId || !leadData) return;
    
    try {
      await updateAssignee.mutateAsync({
        conversationId: selectedConversationId,
        assignedTo: userId,
      });
      await updateLead.mutateAsync({
        id: leadData.id,
        assigned_to: userId,
      });
      toast.success('Lead transferido com sucesso');
    } catch (error) {
      toast.error('Erro ao transferir lead');
    }
  };

  const handleToggleMessageStar = (messageId: string, isStarred: boolean) => {
    toggleMessageStar.mutate({ messageId, isStarred });
  };

  const handleStatusChange = (status: ConversationStatus) => {
    if (!selectedConversationId) return;
    updateConversationStatus.mutate(
      { conversationId: selectedConversationId, status },
      {
        onSuccess: () => {
          const statusLabels = { open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida' };
          toast.success(`Conversa marcada como ${statusLabels[status]}`);
        },
        onError: () => {
          toast.error('Erro ao atualizar status');
        },
      }
    );
  };

  const lead = leadData as any;
  const leadWithLabels = lead ? {
    ...lead,
    labels: leadLabels?.map((ll: any) => ll.labels) || [],
  } : null;

  // Em mobile, mostra lista ou chat, não ambos
  const showConversationList = !isMobile || !selectedConversationId;
  const showChatArea = !isMobile || selectedConversationId;

  return (
    <div className={cn(
      "h-[calc(100vh-4rem)] flex min-w-0 overflow-hidden relative",
      isMobile && "h-[calc(100vh-4rem-3.5rem)]" // Espaço para bottom nav
    )}>
      {/* Conversation List */}
      {showConversationList && (
      <div className={cn(
        "w-72 md:w-80 xl:w-96 border-r border-border flex flex-col bg-card shrink-0 min-w-0",
        isMobile && "w-full border-r-0"
      )}>
        {/* Header with New Conversation Button */}
        <div className="p-3 border-b border-border flex items-center justify-between bg-card">
          <span className="font-semibold text-sm">Conversas</span>
          <Button
            size="sm"
            onClick={() => setShowNewConversationModal(true)}
            className="h-8 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nova conversa
          </Button>
        </div>
        
        {/* Search and Filter */}
        <div className="p-4 space-y-3 border-b border-border bg-card sticky top-0 z-30 shadow-sm isolate">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversas..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ConversationStatusTabs
            value={statusFilter}
            onChange={setStatusFilter}
            counts={statusCounts}
          />

          <Tabs value={filter} onValueChange={(v) => setFilter(v as InboxFilter)}>
            <TabsList className="w-full bg-muted relative z-10">
              <TabsTrigger value="novos" className="flex-1 text-xs">Novos</TabsTrigger>
              <TabsTrigger value="meus" className="flex-1 text-xs">Meus</TabsTrigger>
              <TabsTrigger value="outros" className="flex-1 text-xs">Outros</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Label Filter & Sort */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Etiquetas
                  {selectedLabelIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                      {selectedLabelIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 max-h-96 flex flex-col" align="start">
                <div className="p-3 border-b border-border bg-popover sticky top-0 z-10 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filtrar por etiquetas</span>
                    {selectedLabelIds.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearLabelFilters}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-3">
                    {Object.entries(labelsByCategory).map(([category, labels]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                          {categoryLabels[category] || category}
                        </p>
                        <div className="space-y-0.5">
                          {labels?.map((label) => (
                            <label
                              key={label.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedLabelIds.includes(label.id)}
                                onCheckedChange={() => toggleLabelFilter(label.id)}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="text-sm">{label.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuItem 
                  onClick={() => setSortOrder('recent')}
                  className={sortOrder === 'recent' ? 'bg-accent' : ''}
                >
                  Últimas interações primeiro
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortOrder('oldest')}
                  className={sortOrder === 'oldest' ? 'bg-accent' : ''}
                >
                  Mais antigos primeiro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Selected Labels Pills */}
            {selectedLabelIds.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap flex-1">
                {selectedLabelIds.slice(0, 2).map((labelId) => {
                  const label = allLabels?.find((l) => l.id === labelId);
                  if (!label) return null;
                  return (
                    <Badge
                      key={labelId}
                      className="text-xs px-1.5 py-0 gap-1 cursor-pointer border-0"
                      style={{
                        backgroundColor: label.color,
                        color: 'white',
                      }}
                      onClick={() => toggleLabelFilter(labelId)}
                    >
                      {label.name}
                      <X className="w-2.5 h-2.5" />
                    </Badge>
                  );
                })}
                {selectedLabelIds.length > 2 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    +{selectedLabelIds.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1 overflow-hidden">
          {loadingConversations ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-12 bg-muted rounded" />
                    </div>
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="flex gap-1.5">
                      <div className="h-5 w-16 bg-muted rounded-full" />
                      <div className="h-5 w-14 bg-muted rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-primary">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {searchQuery ? 'Nenhum resultado' : 'Nenhuma conversa'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                {searchQuery 
                  ? `Nenhuma conversa encontrada para "${searchQuery}". Tente outros termos.`
                  : 'Clique em "+ Nova conversa" para iniciar um atendimento'
                }
              </p>
              {!searchQuery && (
                <Button size="sm" onClick={() => setShowNewConversationModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Nova conversa
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conversation) => {
                const convLead = conversation.leads as any;
                const isSelected = selectedConversationId === conversation.id;
                const isFavorite = (conversation as any).is_favorite;
                
                // Determinar melhor nome para exibição:
                // 1. whatsapp_name se disponível
                // 2. nome se não for "Lead XXXXXXXXX" (número de telefone)
                // 3. telefone formatado como fallback
                const isPhoneAsName = convLead?.name?.startsWith('Lead ') && /^Lead \d+$/.test(convLead?.name);
                const displayName = convLead?.whatsapp_name || (!isPhoneAsName ? convLead?.name : null) || formatPhoneNumber(convLead?.phone || '');

                return (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={cn(
                      'px-3 py-3 cursor-pointer transition-colors hover:bg-muted/50',
                      isSelected && 'bg-[#EDE9FE] border-l-[3px] border-l-[#7C3AED]'
                    )}
                  >
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <Avatar className="w-12 h-12 shrink-0">
                        <AvatarImage src={convLead?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${convLead?.name}`} />
                        <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {/* Row 1: Name + Timestamp */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
                            {isFavorite && <Star className="w-3 h-3 fill-warning text-warning shrink-0" />}
                            <span className="font-semibold text-foreground truncate text-[15px]">
                              {displayName}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatConversationDate(new Date(conversation.last_message_at))}
                          </span>
                        </div>

                        {/* Row 2: Last message + Unread/Hot indicators */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground truncate flex-1">
                            {(conversation as any).last_message_content || formatPhoneNumber(convLead?.phone || '')}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {convLead?.temperature === 'hot' && (
                              <span className="text-sm">🔥</span>
                            )}
                            {conversation.unread_count > 0 && (
                              <span className="min-w-[20px] h-5 w-5 bg-[#EF4444] text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 3: Status badge + Labels (simplified) */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 h-5',
                              conversation.status === 'open' && 'border-success text-success',
                              conversation.status === 'pending' && 'border-warning text-warning',
                              conversation.status === 'resolved' && 'border-muted-foreground text-muted-foreground'
                            )}
                          >
                            {conversation.status === 'open' ? 'Aberta' : conversation.status === 'pending' ? 'Pendente' : 'Resolvida'}
                          </Badge>
                          {convLead?.lead_labels?.slice(0, 1).map((ll: any) => (
                            <Badge
                              key={ll.labels?.id}
                              className="text-[10px] px-1.5 py-0 h-5 border-0 max-w-[70px] truncate"
                              style={{
                                backgroundColor: ll.labels?.color,
                                color: 'white',
                              }}
                              title={ll.labels?.name}
                            >
                              {ll.labels?.name}
                            </Badge>
                          ))}
                          {convLead?.lead_labels?.length > 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                              +{convLead.lead_labels.length - 1}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
      )}

      {/* Chat Area */}
      {showChatArea && (
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {selectedConversation && leadWithLabels ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 flex items-center gap-3 border-b border-border bg-card">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Determinar melhor nome para exibição no header do chat */}
                {(() => {
                  const isPhoneAsName = leadWithLabels.name?.startsWith('Lead ') && /^Lead \d+$/.test(leadWithLabels.name);
                  const chatDisplayName = (leadWithLabels as any).whatsapp_name || (!isPhoneAsName ? leadWithLabels.name : null) || formatPhoneNumber(leadWithLabels.phone);
                  return (
                    <>
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={leadWithLabels.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${leadWithLabels.name}`} />
                        <AvatarFallback>{chatDisplayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{chatDisplayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{formatPhoneNumber(leadWithLabels.phone)}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ConversationStatusActions
                  currentStatus={selectedConversation.status}
                  onStatusChange={handleStatusChange}
                  isLoading={updateConversationStatus.isPending}
                />
                <Button variant="ghost" size="icon">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleToggleFavorite}
                >
                  <Star className={cn(
                    "w-4 h-4",
                    (selectedConversation as any).is_favorite && "fill-warning text-warning"
                  )} />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
                <Button 
                  variant={showLeadPanel ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setShowLeadPanel(!showLeadPanel)}
                  title={showLeadPanel ? "Ocultar detalhes do lead" : "Mostrar detalhes do lead"}
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
                className="h-full p-4 bg-muted/30"
                onScrollCapture={handleMessagesScroll}
              >
                <div className="space-y-2 max-w-3xl mx-auto">
                  {loadingMessages ? (
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
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Envie a primeira mensagem para iniciar a conversa
                      </p>
                    </div>
                  ) : (
                    groupedMessages.map((group, groupIndex) => (
                      <div key={group.date.toISOString()}>
                        {/* Date Separator */}
                        <DateSeparator date={group.date} />
                        
                        {/* Messages for this day */}
                        <div className="space-y-4">
                          {group.items.map((item, index) => {
                            if (item.itemType === 'note') {
                              return <InlineNoteMessage key={`note-${item.id}`} note={item as any} />;
                            }

                            const message = item as typeof messages[0] & { itemType: 'message' };
                            const isAgent = message.sender_type === 'agent';
                            const prevItem = group.items[index - 1];
                            const showAvatar = index === 0 || prevItem?.itemType === 'note' || (prevItem as any)?.sender_type !== message.sender_type;

                            return (
                              <MessageBubble
                                key={message.id}
                                message={message as any}
                                isAgent={isAgent}
                                showAvatar={showAvatar}
                                leadName={leadWithLabels.name}
                                leadAvatarUrl={leadWithLabels.avatar_url}
                                onToggleStar={handleToggleMessageStar}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* Scroll to Bottom Button */}
              <ScrollToBottomButton
                show={showScrollButton}
                onClick={scrollToBottom}
              />
            </div>

            {/* Pending File Preview */}
            {pendingFile && (
              <div className="px-4 py-2 bg-muted/50 border-t border-border">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <span className="text-sm text-muted-foreground">Arquivo: {pendingFile.file.name}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setPendingFile(null)}
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
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            <AISuggestions
              suggestions={aiSuggestions.suggestions}
              isLoading={aiSuggestions.isLoading}
              onSelectSuggestion={handleSelectAISuggestion}
              onRefresh={handleRefreshAISuggestions}
            />

            {/* AI Reminder Prompt */}
            <AIReminderPrompt
              show={showReminderPrompt}
              reminder={aiReminders.reminder}
              isLoading={aiReminders.isLoading}
              leadId={leadWithLabels?.id}
              onClose={() => {
                setShowReminderPrompt(false);
                aiReminders.clearReminder();
              }}
            />

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
                    leadName={leadWithLabels.name}
                    leadPhone={leadWithLabels.phone}
                    leadBenefitType={leadWithLabels.benefit_type || undefined}
                    agentName={authUser?.name}
                  />
                </div>

                <div className="flex-1 relative">
                  {showSlashCommand && (
                    <SlashCommandPopover
                      inputValue={messageInput}
                      onSelectTemplate={handleTemplateSelect}
                      leadName={leadWithLabels.name}
                      leadPhone={leadWithLabels.phone}
                      leadBenefitType={leadWithLabels.benefit_type || undefined}
                      agentName={authUser?.name}
                      inputRef={inputRef as React.RefObject<HTMLInputElement>}
                      onClose={() => setShowSlashCommand(false)}
                    />
                  )}
                  <Input
                    ref={inputRef}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (showSlashCommand) return; // Let SlashCommand handle navigation
                      if (e.key === 'Enter' && !e.shiftKey) handleSendMessage();
                    }}
                    placeholder="Digite / para atalhos..."
                    className="pr-12"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
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
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendMessage}
                    disabled={(!messageInput.trim() && !pendingFile) || sendMessage.isPending || uploadProgress.uploading}
                    className="gradient-primary text-primary-foreground min-w-[40px]"
                  >
                    {sendMessage.isPending || uploadProgress.uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
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
        )}
      </div>
      )}

      {/* Lead Panel */}
      <AnimatePresence>
        {selectedConversation && showLeadPanel && (
          isMobile ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-50 bg-background/40 backdrop-blur-sm"
              onClick={() => setShowLeadPanel(false)}
              role="dialog"
              aria-label="Detalhes do lead"
            >
              <motion.aside
                initial={{ x: 360 }}
                animate={{ x: 0 }}
                exit={{ x: 360 }}
                transition={{ type: 'tween', duration: 0.2 }}
                className="absolute right-0 top-0 h-full w-[360px] max-w-[92vw] border-l border-border bg-card shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {loadingLead ? (
                  <LeadDetailsPanelSkeleton />
                ) : leadWithLabels ? (
                  <LeadDetailsPanel
                    lead={leadWithLabels}
                    conversationId={selectedConversation.id}
                    messages={messages}
                    isFavorite={(selectedConversation as any).is_favorite}
                    onToggleFavorite={handleToggleFavorite}
                    onTransfer={handleTransfer}
                    onLabelsUpdate={() => refetchLead()}
                  />
                ) : (
                  <LeadDetailsPanelSkeleton />
                )}
              </motion.aside>
            </motion.div>
          ) : (
            <motion.aside
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-[300px] xl:w-[340px] max-w-[340px] border-l border-border bg-card overflow-hidden shrink-0"
            >
              {loadingLead ? (
                <LeadDetailsPanelSkeleton />
              ) : leadWithLabels ? (
                <LeadDetailsPanel
                  lead={leadWithLabels}
                  conversationId={selectedConversation.id}
                  messages={messages}
                  isFavorite={(selectedConversation as any).is_favorite}
                  onToggleFavorite={handleToggleFavorite}
                  onTransfer={handleTransfer}
                  onLabelsUpdate={() => refetchLead()}
                />
              ) : (
                <LeadDetailsPanelSkeleton />
              )}
            </motion.aside>
          )
        )}
      </AnimatePresence>
      
      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversationModal}
        onOpenChange={setShowNewConversationModal}
        onConversationCreated={(conversationId) => {
          setSelectedConversationId(conversationId);
        }}
      />
    </div>
  );
};

export default Inbox;
