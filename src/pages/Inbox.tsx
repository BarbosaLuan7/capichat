import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
} from '@/hooks/useConversations';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useLeadLabels } from '@/hooks/useLabels';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';

// Components
import { AttachmentMenu } from '@/components/inbox/AttachmentMenu';
import { AudioRecorder } from '@/components/inbox/AudioRecorder';
import { EmojiPicker } from '@/components/inbox/EmojiPicker';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import { MessageBubble } from '@/components/inbox/MessageBubble';
import { LeadDetailsPanel } from '@/components/inbox/LeadDetailsPanel';

import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

const Inbox = () => {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [filter, setFilter] = useState<'all' | ConversationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'image' | 'video' | 'audio' | 'document' } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { data: conversations, isLoading: loadingConversations } = useConversations();
  const { data: selectedConversation } = useConversation(selectedConversationId || undefined);
  const { data: messages, isLoading: loadingMessages } = useMessages(selectedConversationId || undefined);
  const { data: leadData, refetch: refetchLead } = useLead(selectedConversation?.lead_id || undefined);
  const { data: leadLabels } = useLeadLabels(selectedConversation?.lead_id || undefined);
  
  // Mutations
  const sendMessage = useSendMessage();
  const markAsRead = useMarkConversationAsRead();
  const toggleFavorite = useToggleConversationFavorite();
  const updateAssignee = useUpdateConversationAssignee();
  const toggleMessageStar = useToggleMessageStar();
  const updateLead = useUpdateLead();
  
  // File upload
  const { uploadFile, uploadProgress, getFileType } = useFileUpload();
  
  // Audio recorder
  const audioRecorder = useAudioRecorder();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unread_count > 0) {
      markAsRead.mutate(selectedConversationId);
    }
  }, [selectedConversationId, selectedConversation?.unread_count]);

  const filteredConversations = conversations?.filter((conv) => {
    const matchesFilter = filter === 'all' || conv.status === filter;
    const matchesSearch = !searchQuery || 
      (conv.leads as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.leads as any)?.phone?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  }) || [];

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !pendingFile) || !selectedConversationId || !user) return;

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
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
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
      toast.error('Erro ao enviar áudio');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleTemplateSelect = (content: string) => {
    setMessageInput(content);
    inputRef.current?.focus();
  };

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

  const lead = leadData as any;
  const leadWithLabels = lead ? {
    ...lead,
    labels: leadLabels?.map((ll: any) => ll.labels) || [],
  } : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversation List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        {/* Search and Filter */}
        <div className="p-4 space-y-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversas..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">Todas</TabsTrigger>
              <TabsTrigger value="open" className="flex-1 text-xs">Abertas</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 text-xs">Pendentes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
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
                      'p-4 cursor-pointer transition-colors hover:bg-muted/50',
                      isSelected && 'bg-primary/5 border-l-2 border-l-primary'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${convLead?.name}`} />
                          <AvatarFallback>{convLead?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {conversation.unread_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
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
                            {format(new Date(conversation.last_message_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {convLead?.phone}
                        </p>

                        <div className="flex items-center gap-2">
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
      <div className="flex-1 flex flex-col">
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
                  <p className="text-xs text-muted-foreground">{leadWithLabels.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-muted/30">
              <div className="space-y-4 max-w-3xl mx-auto">
                {loadingMessages ? (
                  <div className="text-center text-muted-foreground">Carregando mensagens...</div>
                ) : messages?.length === 0 ? (
                  <div className="text-center text-muted-foreground">Nenhuma mensagem ainda</div>
                ) : (
                  messages?.map((message, index) => {
                    const isAgent = message.sender_type === 'agent';
                    const showAvatar = index === 0 || messages[index - 1]?.sender_type !== message.sender_type;

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
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

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
                  />
                </div>

                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Digite sua mensagem..."
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
                    className="gradient-primary text-primary-foreground"
                  >
                    <Send className="w-4 h-4" />
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
        {leadWithLabels && selectedConversation && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-l border-border bg-card overflow-hidden"
          >
            <LeadDetailsPanel
              lead={leadWithLabels}
              conversationId={selectedConversation.id}
              isFavorite={(selectedConversation as any).is_favorite}
              onToggleFavorite={handleToggleFavorite}
              onTransfer={handleTransfer}
              onLabelsUpdate={() => refetchLead()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inbox;
