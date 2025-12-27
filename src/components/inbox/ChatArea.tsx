import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageSquare,
  Star,
  Mic,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Components
import { AttachmentMenu } from '@/components/inbox/AttachmentMenu';
import { AudioRecorder } from '@/components/inbox/AudioRecorder';
import { EmojiPicker } from '@/components/inbox/EmojiPicker';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import { SlashCommandPopover } from '@/components/inbox/SlashCommandPopover';
import { MessageBubble } from '@/components/inbox/MessageBubble';
import { InlineNoteMessage } from '@/components/inbox/InlineNoteMessage';
import { AISuggestions } from '@/components/inbox/AISuggestions';
import { AIReminderPrompt } from '@/components/inbox/AIReminderPrompt';
import { ConversationStatusActions } from '@/components/inbox/ConversationStatusActions';
import { DateSeparator } from '@/components/inbox/DateSeparator';
import { ScrollToBottomButton } from '@/components/inbox/ScrollToBottomButton';

// Hooks
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useAIReminders } from '@/hooks/useAIReminders';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import { useDraftMessages } from '@/hooks/useDraftMessages';

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
}

interface ChatAreaProps {
  conversation: ConversationData | null;
  lead: LeadWithLabels | null;
  messages: Message[] | undefined;
  isLoadingMessages: boolean;
  onSendMessage: (content: string, type: string, mediaUrl?: string | null) => Promise<void>;
  onStatusChange: (status: ConversationStatus) => void;
  onToggleFavorite: () => void;
  onToggleMessageStar: (messageId: string, isStarred: boolean) => void;
  isUpdatingStatus: boolean;
  showLeadPanel: boolean;
  onToggleLeadPanel: () => void;
  agentName?: string;
}

export function ChatArea({
  conversation,
  lead,
  messages,
  isLoadingMessages,
  onSendMessage,
  onStatusChange,
  onToggleFavorite,
  onToggleMessageStar,
  isUpdatingStatus,
  showLeadPanel,
  onToggleLeadPanel,
  agentName,
}: ChatAreaProps) {
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'image' | 'video' | 'audio' | 'document' } | null>(null);
  const [showSlashCommand, setShowSlashCommand] = useState(false);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const ignoreScrollRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  // Hooks
  const { uploadFile, uploadProgress } = useFileUpload();
  const audioRecorder = useAudioRecorder();
  const aiSuggestions = useAISuggestions();
  const aiReminders = useAIReminders();
  const { data: internalNotes } = useInternalNotes(conversation?.id || undefined);
  const { draft, saveDraft, clearDraft } = useDraftMessages(conversation?.id);

  // Use draft as messageInput value
  const messageInput = draft;
  const setMessageInput = saveDraft;

  // Auto-scroll to bottom when NEW messages arrive
  // Force scroll if message is from lead (response) to ensure user sees it
  useEffect(() => {
    if (!messages?.length) return;
    
    const lastMessage = messages[messages.length - 1];
    const isNewMessage = lastMessage.id !== lastMessageIdRef.current;
    
    if (isNewMessage) {
      lastMessageIdRef.current = lastMessage.id;
      
      // Force scroll if:
      // 1. User is near the bottom, OR
      // 2. It's a new message from the lead (response)
      if (isNearBottomRef.current || lastMessage.sender_type === 'lead') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Auto-scroll when conversation changes
  useEffect(() => {
    if (conversation?.id && !isLoadingMessages && messages && messages.length > 0) {
      ignoreScrollRef.current = true;
      setShowScrollButton(false);
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }
          
          setTimeout(() => {
            ignoreScrollRef.current = false;
          }, 300);
        });
      });
    }
  }, [conversation?.id, isLoadingMessages, messages?.length]);

  // Fetch AI suggestions when conversation changes (with throttling)
  const lastSuggestionFetchRef = useRef<number>(0);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear pending timeout on conversation change
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }
    
    if (!messages || messages.length === 0 || !lead || !conversation?.id) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastSuggestionFetchRef.current;
    const THROTTLE_MS = 3000; // 3 seconds throttle
    
    // Throttle: wait at least 3s between fetches
    const delay = Math.max(0, THROTTLE_MS - timeSinceLastFetch);
    
    suggestionTimeoutRef.current = setTimeout(() => {
      lastSuggestionFetchRef.current = Date.now();
      aiSuggestions.fetchSuggestions(
        messages.slice(-10),
        {
          name: lead.name,
          stage: lead.funnel_stages?.name,
          temperature: lead.temperature,
          labels: lead.labels,
        }
      );
    }, delay);
    
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [conversation?.id, messages?.length]);

  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (ignoreScrollRef.current) return;
    
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    // Update near bottom state (within 100px of bottom)
    isNearBottomRef.current = distanceFromBottom < 100;
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

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
    setIsSending(true);
    
    try {
      let mediaUrl: string | null = null;
      let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';

      if (pendingFile) {
        mediaUrl = await uploadFile(pendingFile.file);
        messageType = pendingFile.type;
        setPendingFile(null);
      }

      await onSendMessage(
        messageInput || (messageType !== 'text' ? `[${messageType}]` : ''),
        messageType,
        mediaUrl
      );

      clearDraft();
      inputRef.current?.focus();
      
      // Check for reminders
      if (sentMessage.trim().length > 10) {
        const reminderResult = await aiReminders.detectReminder(sentMessage, lead?.name);
        if (reminderResult?.hasReminder) {
          setShowReminderPrompt(true);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    setPendingFile({ file, type });
    toast.info(`Arquivo selecionado: ${file.name}`);
  };

  const handleAudioSend = async () => {
    if (!audioRecorder.audioBlob || !conversation) return;

    try {
      const file = new File([audioRecorder.audioBlob], 'audio.webm', { type: 'audio/webm' });
      const mediaUrl = await uploadFile(file, 'audio');

      await onSendMessage('[Áudio]', 'audio', mediaUrl);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);
    setShowSlashCommand(value.includes('/'));
  };
  
  const handleSelectAISuggestion = (text: string) => {
    setMessageInput(text);
    inputRef.current?.focus();
  };
  
  const handleRefreshAISuggestions = () => {
    if (messages && messages.length > 0 && lead) {
      aiSuggestions.fetchSuggestions(
        messages.slice(-10),
        {
          name: lead.name,
          stage: lead.funnel_stages?.name,
          temperature: lead.temperature,
          labels: lead.labels,
        }
      );
    }
  };

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
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="h-16 px-4 flex items-center gap-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={lead.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`} />
            <AvatarFallback>{chatDisplayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{chatDisplayName}</p>
            <p className="text-xs text-muted-foreground truncate">{formatPhoneNumber(lead.phone)}</p>
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
          className="h-full p-4 bg-muted/30"
          onScrollCapture={handleMessagesScroll}
        >
          <div className="space-y-2 max-w-3xl mx-auto">
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
                <p className="text-sm text-muted-foreground max-w-xs">
                  Envie a primeira mensagem para iniciar a conversa
                </p>
              </div>
            ) : (
              groupedMessages.map((group) => (
                <div key={group.date.toISOString()}>
                  <DateSeparator date={group.date} />
                  
                  <div className="space-y-4">
                    {group.items.map((item, index) => {
                      if (item.itemType === 'note') {
                        return <InlineNoteMessage key={`note-${item.id}`} note={item as any} />;
                      }

                      const message = item as MessageItem;
                      const isAgent = message.sender_type === 'agent';
                      const prevItem = group.items[index - 1];
                      const showAvatar = index === 0 || prevItem?.itemType === 'note' || (prevItem as any)?.sender_type !== message.sender_type;

                      return (
                        <MessageBubble
                          key={message.id}
                          message={message as any}
                          isAgent={isAgent}
                          showAvatar={showAvatar}
                          leadName={lead.name}
                          leadAvatarUrl={lead.avatar_url}
                          onToggleStar={onToggleMessageStar}
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
        leadId={lead?.id}
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
              onKeyDown={(e) => {
                if (showSlashCommand) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Prevent double-send: check isSending and uploadProgress
                  if (!isSending && !uploadProgress.uploading) {
                    handleSendMessage();
                  }
                }
              }}
              placeholder="Digite / para atalhos... (Shift+Enter para nova linha)"
              className="pr-12 resize-none min-h-[40px] max-h-[120px] overflow-y-auto py-2"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <div className="absolute right-1 bottom-2">
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
              aria-label="Gravar áudio"
            >
              <Mic className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={(!messageInput.trim() && !pendingFile) || isSending || uploadProgress.uploading}
              className="gradient-primary text-primary-foreground min-w-[40px]"
              aria-label={isSending || uploadProgress.uploading ? "Enviando..." : "Enviar mensagem"}
            >
              {isSending || uploadProgress.uploading ? (
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
}
