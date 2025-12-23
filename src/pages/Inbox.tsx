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
import { Checkbox } from '@/components/ui/checkbox';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useAIReminders } from '@/hooks/useAIReminders';

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
import { DateSeparator } from '@/components/inbox/DateSeparator';
import { ScrollToBottomButton } from '@/components/inbox/ScrollToBottomButton';

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
  const [showLeadPanel, setShowLeadPanel] = useState(() => {
    const saved = localStorage.getItem('inbox-show-lead-panel');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Persist lead panel toggle
  useEffect(() => {
    localStorage.setItem('inbox-show-lead-panel', String(showLeadPanel));
  }, [showLeadPanel]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Data hooks
  const { data: conversations, isLoading: loadingConversations } = useConversations();
  const { data: selectedConversation } = useConversation(selectedConversationId || undefined);
  const { data: messages, isLoading: loadingMessages } = useMessages(selectedConversationId || undefined);
  const { data: leadData, refetch: refetchLead } = useLead(selectedConversation?.lead_id || undefined);
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

  // Handle scroll to detect if user scrolled up
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  }, []);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unread_count > 0) {
      markAsRead.mutate(selectedConversationId);
    }
  }, [selectedConversationId, selectedConversation?.unread_count]);

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
    return conversations?.filter((conv) => {
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
  }, [conversations, statusFilter, filter, user?.id, searchQuery, selectedLabelIds]);

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

  return (
    <div className="h-[calc(100vh-4rem)] flex min-w-0 overflow-hidden">
      {/* Conversation List */}
      <div className="w-64 xl:w-80 border-r border-border flex flex-col bg-card flex-shrink-0">
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

          {/* Label Filter */}
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
            <div className="p-4 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhuma conversa encontrada
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conversation) => {
                const convLead = conversation.leads as any;
                const isSelected = selectedConversationId === conversation.id;
                const isFavorite = (conversation as any).is_favorite;

                return (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={cn(
                      'p-4 cursor-pointer transition-colors hover:bg-muted/50 overflow-hidden isolate',
                      isSelected && 'bg-primary/5 border-l-2 border-l-primary'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0 overflow-visible">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${convLead?.name}`} />
                          <AvatarFallback>{convLead?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {conversation.unread_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center shadow-sm">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            {isFavorite && <Star className="w-3 h-3 fill-warning text-warning" />}
                            <span className="font-semibold text-foreground truncate">
                              {convLead?.name}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatConversationDate(new Date(conversation.last_message_at))}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {(conversation as any).last_message_content || formatPhoneNumber(convLead?.phone || '')}
                        </p>

                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              conversation.status === 'open' && 'border-success text-success',
                              conversation.status === 'pending' && 'border-warning text-warning',
                              conversation.status === 'resolved' && 'border-muted-foreground text-muted-foreground'
                            )}
                          >
                            {conversation.status === 'open' ? 'Aberta' : conversation.status === 'pending' ? 'Pendente' : 'Resolvida'}
                          </Badge>
                          {convLead?.temperature === 'hot' && (
                            <Badge className="bg-destructive/10 text-destructive text-xs">
                              Quente
                            </Badge>
                          )}
                          {/* Lead Labels */}
                          {convLead?.lead_labels?.slice(0, 2).map((ll: any) => (
                            <Badge
                              key={ll.labels?.id}
                              className="text-xs px-1.5 py-0 border-0"
                              style={{
                                backgroundColor: ll.labels?.color,
                                color: 'white',
                              }}
                            >
                              {ll.labels?.name}
                            </Badge>
                          ))}
                          {convLead?.lead_labels?.length > 2 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              +{convLead.lead_labels.length - 2}
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

      {/* Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {selectedConversation && leadWithLabels ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${leadWithLabels.name}`} />
                  <AvatarFallback>{leadWithLabels.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{leadWithLabels.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPhoneNumber(leadWithLabels.phone)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowLeadPanel(!showLeadPanel)}
                  title={showLeadPanel ? "Ocultar detalhes" : "Mostrar detalhes"}
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
                    <div className="text-center text-muted-foreground">Carregando mensagens...</div>
                  ) : groupedMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground">Nenhuma mensagem ainda</div>
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

      {/* Lead Panel */}
      <AnimatePresence>
        {leadWithLabels && selectedConversation && showLeadPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-[280px] xl:w-[320px] border-l border-border bg-card overflow-hidden flex-shrink-0"
          >
            <LeadDetailsPanel
              lead={leadWithLabels}
              conversationId={selectedConversation.id}
              messages={messages}
              isFavorite={(selectedConversation as any).is_favorite}
              onToggleFavorite={handleToggleFavorite}
              onTransfer={handleTransfer}
              onLabelsUpdate={() => refetchLead()}
            />
          </motion.div>
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
