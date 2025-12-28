import { useState, useMemo, memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  Mail,
  Copy,
  Tag,
  UserPlus,
  Star,
  MessageSquare,
  ExternalLink,
  User,
  History,
  Sparkles,
  Brain,
  ClipboardList,
  Loader2,
  StickyNote,
  Activity,
  Filter,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, getContrastTextColor } from '@/lib/utils';
import { toast } from 'sonner';
import { TransferLeadModal } from './TransferLeadModal';
import { LeadLabelsModal } from './LeadLabelsModal';
import { InternalNotes } from './InternalNotes';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { AIClassificationSuggestion } from './AIClassificationSuggestion';
import { AIConversationSummary } from './AIConversationSummary';
import { DocumentChecklist } from './DocumentChecklist';
import { formatPhoneNumber, formatCPF, toWhatsAppFormat, maskCPF } from '@/lib/masks';
import { useLeadActivities, formatActivityMessage } from '@/hooks/useLeadActivities';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import { getDocumentsByBenefitType, type BenefitType } from '@/lib/documentChecklist';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Label = Database['public']['Tables']['labels']['Row'];

interface LeadDetailsPanelProps {
  lead: Lead & {
    funnel_stages?: { id: string; name: string; color: string; grupo?: string | null } | null;
    labels?: Label[];
  };
  conversationId: string;
  messages?: any[];
  isFavorite?: boolean;
  onToggleFavorite: () => void;
  onTransfer: (userId: string) => void;
  onLabelsUpdate: () => void;
}

function LeadDetailsPanelComponent({
  lead,
  conversationId,
  messages,
  isFavorite,
  onToggleFavorite,
  onTransfer,
  onLabelsUpdate,
}: LeadDetailsPanelProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('all');

  // Fetch lead activities and notes from database
  const { data: activities, isLoading: activitiesLoading } = useLeadActivities(lead.id);
  const { data: notes } = useInternalNotes(conversationId);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/${toWhatsAppFormat(lead.phone)}`, '_blank');
  };

  const labelIds = lead.labels?.map((l) => l.id) || [];
  const qualification = (lead as any).qualification || {};

  // Map activities to timeline events
  const getEventType = (action: string): 'message' | 'stage_change' | 'label_added' | 'assigned' | 'task_completed' | 'note' => {
    switch (action) {
      case 'stage_changed':
        return 'stage_change';
      case 'label_added':
      case 'label_removed':
        return 'label_added';
      case 'assigned':
        return 'assigned';
      case 'note_added':
        return 'note';
      case 'message_sent':
      case 'message_received':
        return 'message';
      default:
        return 'assigned';
    }
  };

  const allTimelineEvents = useMemo(() => {
    const events = activities?.map(activity => ({
      id: activity.id,
      type: getEventType(activity.action),
      title: formatActivityMessage(activity.action, activity.details || {}),
      description: activity.details?.description || activity.details?.content,
      createdAt: new Date(activity.created_at),
      user: activity.profiles?.name,
    })) || [];

    // Always add lead creation event
    events.push({
      id: 'created',
      type: 'assigned' as const,
      title: 'Lead criado',
      description: `Origem: ${lead.source}`,
      createdAt: new Date(lead.created_at),
      user: undefined,
    });

    return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [activities, lead.source, lead.created_at]);

  // Filter events based on selected filter
  const filteredEvents = useMemo(() => {
    if (activityFilter === 'all') return allTimelineEvents;
    return allTimelineEvents.filter(event => event.type === activityFilter);
  }, [allTimelineEvents, activityFilter]);

  return (
    <>
      <div className="h-full w-full max-w-full min-w-[320px] flex flex-col overflow-hidden">
        {/* Lead Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="w-14 h-14">
                <AvatarImage
                  src={(lead as any).avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`}
                />
                <AvatarFallback className="text-lg">
                  {lead.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute -right-1 -top-1 h-6 w-6 rounded-full bg-card border border-border',
                        isFavorite && 'text-warning'
                      )}
                      onClick={onToggleFavorite}
                      aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <Star
                        className={cn('w-3 h-3', isFavorite && 'fill-warning')}
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1 min-w-0">
              {(() => {
                const isPhoneAsName = lead.name?.startsWith('Lead ') && /^Lead \d+$/.test(lead.name);
                const panelDisplayName = (lead as any).whatsapp_name || (!isPhoneAsName ? lead.name : null) || formatPhoneNumber(lead.phone);
                return (
                  <>
                    <h3 className="font-semibold text-foreground truncate" title={panelDisplayName}>
                      {panelDisplayName}
                    </h3>
                    {(lead as any).whatsapp_name && (lead as any).whatsapp_name !== lead.name && !isPhoneAsName && (
                      <p className="text-xs text-muted-foreground">
                        WhatsApp: {(lead as any).whatsapp_name}
                      </p>
                    )}
                  </>
                );
              })()}
              {lead.funnel_stages && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      borderColor: lead.funnel_stages.color,
                      color: lead.funnel_stages.color,
                    }}
                  >
                    {lead.funnel_stages.name}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowTransferModal(true)}
            >
              <UserPlus className="w-3 h-3 mr-1" />
              Transferir
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowLabelsModal(true)}
            >
              <Tag className="w-3 h-3 mr-1" />
              Etiquetar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={openWhatsApp}
                    aria-label="Abrir conversa no WhatsApp"
                  >
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir no WhatsApp</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="flex-1 flex flex-col min-h-0 overflow-hidden w-full max-w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4 shrink-0">
            <TabsTrigger value="dados" className="text-xs gap-1 data-[state=active]:bg-muted">
              <User className="w-3 h-3" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs gap-1 data-[state=active]:bg-muted relative">
              <ClipboardList className="w-3 h-3" />
              Docs
              {(() => {
                const customFields = (lead as any).custom_fields;
                const checklistState = customFields?.documentChecklist;
                if (!checklistState?.benefitType) return null;
                
                const benefit = getDocumentsByBenefitType(checklistState.benefitType as BenefitType);
                if (!benefit) return null;
                
                const total = benefit.documents.length;
                const checked = checklistState.checkedDocuments?.length || 0;
                const pending = total - checked;
                
                if (pending > 0) {
                  return (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-2xs">
                      {pending}
                    </Badge>
                  );
                }
                return null;
              })()}
            </TabsTrigger>
            <TabsTrigger value="ia" className="text-xs gap-1 data-[state=active]:bg-muted">
              <Brain className="w-3 h-3" />
              IA
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs gap-1 data-[state=active]:bg-muted">
              <History className="w-3 h-3" />
              Histórico
              {(notes?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-2xs">
                  {notes?.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent value="dados" className="flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden flex flex-col">
            <ScrollArea className="flex-1 min-h-0 w-full max-w-full [&_[data-radix-scroll-area-viewport]]:!overflow-x-hidden [&_[data-radix-scroll-area-viewport]]:max-w-full">
              <div className="p-4 space-y-4 pb-8 max-w-full min-w-0 overflow-hidden box-border">
                {/* AI Summary */}
                {(lead as any).ai_summary && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 overflow-hidden">
                    <div className="flex items-center gap-2 text-primary text-xs font-medium mb-2">
                      <Sparkles className="w-3 h-3" />
                      Resumo IA
                    </div>
                    <div className="overflow-y-auto max-h-[200px]">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {(lead as any).ai_summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-2">
                  <h4 className="font-medium text-xs text-muted-foreground uppercase">
                    Contato
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm flex-1">{formatPhoneNumber(lead.phone)}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => handleCopy(lead.phone, 'Telefone')}
                                aria-label="Copiar telefone"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar telefone</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-success"
                                onClick={openWhatsApp}
                                aria-label="Abrir no WhatsApp"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Abrir no WhatsApp</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm truncate flex-1" title={lead.email}>{lead.email}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleCopy(lead.email!, 'Email')}
                                aria-label="Copiar email"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar email</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                    {lead.cpf && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                        <span className="text-xs font-medium text-muted-foreground w-4">
                          CPF
                        </span>
                        <span className="text-sm flex-1">{maskCPF(lead.cpf)}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleCopy(lead.cpf!, 'CPF')}
                                aria-label="Copiar CPF"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar CPF completo</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </div>

                {/* Labels */}
                {lead.labels && lead.labels.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase">
                      Etiquetas
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.labels.map((label) => (
                        <Badge
                          key={label.id}
                          className={cn("text-xs border-0", getContrastTextColor(label.color))}
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Qualification */}
                {Object.keys(qualification).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase">
                      Qualificação
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      {qualification.situacao && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Situação:</span>
                          <span className="text-right min-w-0 break-words">{qualification.situacao}</span>
                        </div>
                      )}
                      {qualification.condicao_saude && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Condição:</span>
                          <span className="text-right min-w-0 break-words">{qualification.condicao_saude}</span>
                        </div>
                      )}
                      {qualification.renda && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Renda:</span>
                          <span className="text-right min-w-0 break-words">{qualification.renda}</span>
                        </div>
                      )}
                      {qualification.idade && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Idade:</span>
                          <span className="text-right min-w-0 break-words">{qualification.idade} anos</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stage & Source */}
                <div className="space-y-2">
                  <h4 className="font-medium text-xs text-muted-foreground uppercase">
                    Informações
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    {lead.funnel_stages && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-foreground shrink-0">Etapa:</span>
                        <Badge
                          variant="outline"
                          className="text-xs max-w-[60%] truncate"
                          style={{
                            borderColor: lead.funnel_stages.color,
                            color: lead.funnel_stages.color,
                          }}
                          title={lead.funnel_stages.name}
                        >
                          {lead.funnel_stages.name}
                        </Badge>
                      </div>
                    )}
                    {lead.funnel_stages?.grupo && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Grupo:</span>
                        <span className="text-right min-w-0 break-words">{lead.funnel_stages.grupo}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Origem:</span>
                      <span className="text-right min-w-0 break-words">{lead.source || 'Não informada'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Criado:</span>
                      <span>
                        {lead.created_at
                          ? format(new Date(lead.created_at), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : 'Não informado'}
                      </span>
                    </div>
                    {lead.estimated_value && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Valor:</span>
                        <span className="font-medium text-success">
                          R$ {lead.estimated_value.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Docs Tab */}
          <TabsContent value="docs" className="flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <DocumentChecklist
                  leadId={lead.id}
                  customFields={(lead as any).custom_fields}
                  labels={lead.labels}
                  onUpdate={onLabelsUpdate}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* IA Tab */}
          <TabsContent value="ia" className="flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* AI Summary */}
                <AIConversationSummary
                  messages={messages || []}
                  lead={lead}
                  onSummaryGenerated={onLabelsUpdate}
                />

                {/* AI Classification */}
                <AIClassificationSuggestion
                  messages={messages || []}
                  lead={lead}
                  onApplyClassification={onLabelsUpdate}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico" className="flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Seção de Notas Internas */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-warning" />
                    <h3 className="font-medium text-sm">Notas Internas</h3>
                    {(notes?.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {notes?.length}
                      </Badge>
                    )}
                  </div>
                  <InternalNotes conversationId={conversationId} />
                </div>

                <Separator />

                {/* Seção de Histórico de Atividades */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <h3 className="font-medium text-sm">Histórico de Atividades</h3>
                    </div>
                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                      <SelectTrigger className="w-[140px] h-7 text-xs">
                        <Filter className="w-3 h-3 mr-1" />
                        <SelectValue placeholder="Filtrar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="stage_change">Mudanças de etapa</SelectItem>
                        <SelectItem value="label_added">Etiquetas</SelectItem>
                        <SelectItem value="assigned">Atribuições</SelectItem>
                        <SelectItem value="note">Notas</SelectItem>
                        <SelectItem value="message">Mensagens</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {activitiesLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Carregando histórico...
                    </div>
                  ) : (
                    <LeadTimeline events={filteredEvents} />
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <TransferLeadModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        onTransfer={onTransfer}
        currentAssignee={lead.assigned_to || undefined}
      />

      <LeadLabelsModal
        open={showLabelsModal}
        onOpenChange={(open) => {
          setShowLabelsModal(open);
          if (!open) onLabelsUpdate();
        }}
        leadId={lead.id}
        currentLabelIds={labelIds}
      />
    </>
  );
}

// Memoize para evitar re-renders desnecessários
export const LeadDetailsPanel = memo(LeadDetailsPanelComponent);