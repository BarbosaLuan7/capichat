import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  Clock,
  Send,
  Paperclip,
  Smile,
  Image,
  Mic,
  Check,
  CheckCheck,
  MessageSquare,
  User,
  Tag,
  ChevronRight,
  Star,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/appStore';
import { mockLeads, mockLabels } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Inbox = () => {
  const {
    conversations,
    messages,
    selectedConversationId,
    setSelectedConversation,
    addMessage,
    markConversationAsRead,
  } = useAppStore();

  const [messageInput, setMessageInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');

  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'all') return true;
    return conv.status === filter;
  });

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );
  const selectedLead = selectedConversation
    ? mockLeads.find((l) => l.id === selectedConversation.leadId)
    : null;

  const conversationMessages = messages.filter(
    (m) => m.conversationId === selectedConversationId
  );

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    markConversationAsRead(id);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversationId) return;

    addMessage({
      conversationId: selectedConversationId,
      senderId: '3',
      senderType: 'agent',
      content: messageInput,
      type: 'text',
      status: 'sent',
    });

    setMessageInput('');
  };

  const getLeadLabels = (labelIds: string[]) => {
    return mockLabels.filter((l) => labelIds.includes(l.id));
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversation List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        {/* Search and Filter */}
        <div className="p-4 space-y-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar conversas..." className="pl-9" />
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
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation) => {
              const lead = mockLeads.find((l) => l.id === conversation.leadId);
              const lastMessage = messages
                .filter((m) => m.conversationId === conversation.id)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
              const isSelected = selectedConversationId === conversation.id;

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
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead?.name}`} />
                        <AvatarFallback>{lead?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {conversation.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground truncate">
                          {lead?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(conversation.lastMessageAt, 'HH:mm', { locale: ptBR })}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {lastMessage?.content || 'Sem mensagens'}
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
                        {lead && lead.temperature === 'hot' && (
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
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation && selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedLead.name}`} />
                  <AvatarFallback>{selectedLead.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{selectedLead.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedLead.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Star className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-muted/30">
              <div className="space-y-4 max-w-3xl mx-auto">
                {conversationMessages.map((message, index) => {
                  const isAgent = message.senderType === 'agent';
                  const showAvatar = index === 0 || conversationMessages[index - 1]?.senderType !== message.senderType;

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('flex gap-2', isAgent && 'flex-row-reverse')}
                    >
                      {showAvatar ? (
                        <Avatar className="w-8 h-8">
                          <AvatarImage
                            src={
                              isAgent
                                ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pedro'
                                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedLead.name}`
                            }
                          />
                          <AvatarFallback>{isAgent ? 'P' : selectedLead.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8" />
                      )}

                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2.5',
                          isAgent
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-card border border-border rounded-tl-sm'
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className={cn('flex items-center gap-1 mt-1', isAgent && 'justify-end')}>
                          <span className={cn('text-xs', isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {format(message.createdAt, 'HH:mm', { locale: ptBR })}
                          </span>
                          {isAgent && (
                            <span className="text-primary-foreground/70">
                              {message.status === 'read' ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Image className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex-1 relative">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="pr-12"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <Smile className="w-5 h-5" />
                  </Button>
                </div>

                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="gradient-primary text-primary-foreground"
                >
                  <Send className="w-4 h-4" />
                </Button>
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
        {selectedLead && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-l border-border bg-card overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Lead Info */}
                <div className="text-center">
                  <Avatar className="w-20 h-20 mx-auto mb-3">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedLead.name}`} />
                    <AvatarFallback className="text-2xl">{selectedLead.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-lg text-foreground">{selectedLead.name}</h3>
                  <Badge
                    className={cn(
                      'mt-2',
                      selectedLead.temperature === 'hot' && 'bg-destructive/10 text-destructive',
                      selectedLead.temperature === 'warm' && 'bg-warning/10 text-warning',
                      selectedLead.temperature === 'cold' && 'bg-primary/10 text-primary'
                    )}
                  >
                    {selectedLead.temperature === 'hot' ? '🔥 Quente' : selectedLead.temperature === 'warm' ? '🌡️ Morno' : '❄️ Frio'}
                  </Badge>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">CONTATO</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{selectedLead.phone}</span>
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm truncate">{selectedLead.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Labels */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">ETIQUETAS</h4>
                  <div className="flex flex-wrap gap-2">
                    {getLeadLabels(selectedLead.labelIds).map((label) => (
                      <Badge
                        key={label.id}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: label.color, color: label.color }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Value */}
                {selectedLead.estimatedValue && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">VALOR ESTIMADO</h4>
                    <p className="text-2xl font-bold text-success">
                      R$ {selectedLead.estimatedValue.toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">HISTÓRICO</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-muted-foreground">Criado em</span>
                      <span className="ml-auto">
                        {format(selectedLead.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Origem</span>
                      <span className="ml-auto">{selectedLead.source}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-between">
                    Ver perfil completo
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between">
                    Criar tarefa
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inbox;
