import React, { useState, useMemo, memo, Suspense } from 'react';
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
import { LeadAvatar } from '@/components/ui/lead-avatar';
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
import { DocumentChecklist } from './DocumentChecklist';

// Lazy loaded AI components - loaded only when IA tab is active
const AIClassificationSuggestion = React.lazy(() =>
  import('./AIClassificationSuggestion').then((m) => ({ default: m.AIClassificationSuggestion }))
);
const AIConversationSummary = React.lazy(() =>
  import('./AIConversationSummary').then((m) => ({ default: m.AIConversationSummary }))
);
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
  const getEventType = (
    action: string
  ): 'message' | 'stage_change' | 'label_added' | 'assigned' | 'task_completed' | 'note' => {
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
    const events =
      activities?.map((activity) => ({
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
    return allTimelineEvents.filter((event) => event.type === activityFilter);
  }, [allTimelineEvents, activityFilter]);

  return (
    <>
      <div className="flex h-full w-full min-w-[320px] max-w-full flex-col overflow-hidden">
        {/* Lead Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-start gap-3">
            <div className="relative">
              <LeadAvatar lead={lead} size="lg" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute -right-1 -top-1 h-6 w-6 rounded-full border border-border bg-card',
                        isFavorite && 'text-warning'
                      )}
                      onClick={onToggleFavorite}
                      aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <Star
                        className={cn('h-3 w-3', isFavorite && 'fill-warning')}
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
            <div className="min-w-0 flex-1">
              {(() => {
                const isPhoneAsName =
                  lead.name?.startsWith('Lead ') && /^Lead \d+$/.test(lead.name);
                const panelDisplayName =
                  (lead as any).whatsapp_name ||
                  (!isPhoneAsName ? lead.name : null) ||
                  formatPhoneNumber(lead.phone);
                return (
                  <>
                    <h3 className="truncate font-semibold text-foreground" title={panelDisplayName}>
                      {panelDisplayName}
                    </h3>
                    {(lead as any).whatsapp_name &&
                      (lead as any).whatsapp_name !== lead.name &&
                      !isPhoneAsName && (
                        <p className="text-xs text-muted-foreground">
                          WhatsApp: {(lead as any).whatsapp_name}
                        </p>
                      )}
                  </>
                );
              })()}
              {lead.funnel_stages && (
                <div className="mt-1 flex items-center gap-2">
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
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowTransferModal(true)}
            >
              <UserPlus className="mr-1 h-3 w-3" />
              Transferir
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowLabelsModal(true)}
            >
              <Tag className="mr-1 h-3 w-3" />
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
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir no WhatsApp</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          defaultValue="dados"
          className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden"
        >
          <TabsList className="w-full shrink-0 justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger value="dados" className="gap-1 text-xs data-[state=active]:bg-muted">
              <User className="h-3 w-3" />
              Dados
            </TabsTrigger>
            <TabsTrigger
              value="docs"
              className="relative gap-1 text-xs data-[state=active]:bg-muted"
            >
              <ClipboardList className="h-3 w-3" />
              Docs
              {(() => {
                const customFields = (lead as any).custom_fields;
                const checklistState = customFields?.documentChecklist;
                if (!checklistState?.benefitType) return null;

                const benefit = getDocumentsByBenefitType(
                  checklistState.benefitType as BenefitType
                );
                if (!benefit) return null;

                const total = benefit.documents.length;
                const checked = checklistState.checkedDocuments?.length || 0;
                const pending = total - checked;

                if (pending > 0) {
                  return (
                    <Badge variant="destructive" className="text-2xs ml-1 h-4 px-1">
                      {pending}
                    </Badge>
                  );
                }
                return null;
              })()}
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-1 text-xs data-[state=active]:bg-muted">
              <Brain className="h-3 w-3" />
              IA
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1 text-xs data-[state=active]:bg-muted">
              <History className="h-3 w-3" />
              Histórico
              {(notes?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="text-2xs ml-1 h-4 px-1">
                  {notes?.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent
            value="dados"
            className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <ScrollArea className="min-h-0 w-full max-w-full flex-1 [&_[data-radix-scroll-area-viewport]]:max-w-full [&_[data-radix-scroll-area-viewport]]:!overflow-x-hidden">
              <div className="box-border min-w-0 max-w-full space-y-4 overflow-hidden p-4 pb-8">
                {/* Facebook LID Warning */}
                {(lead as any).is_facebook_lid && (
                  <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/20">
                        <span className="text-xs text-warning">!</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-warning">Número Privado</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Contato veio de anúncio Facebook. O número real ainda não foi resolvido
                          por privacidade.
                        </p>
                      </div>
                    </div>
                    {(lead as any).original_lid && (
                      <div className="rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                        LID: {(lead as any).original_lid}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase text-muted-foreground">Contato</h4>
                  <div className="space-y-1.5">
                    {/* Phone - with special handling for LID leads */}
                    {(lead as any).is_facebook_lid ? (
                      <div className="group flex items-center gap-2 rounded-md border border-warning/20 bg-warning/5 p-2">
                        <Phone className="h-3.5 w-3.5 text-warning" />
                        <span className="flex-1 text-sm italic text-muted-foreground">
                          Aguardando resolução...
                        </span>
                        <Badge
                          variant="outline"
                          className="text-2xs border-warning/30 text-warning"
                        >
                          Facebook
                        </Badge>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2 rounded-md bg-muted/50 p-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 text-sm">{formatPhoneNumber(lead.phone)}</span>
                        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
                                  <Copy className="h-2.5 w-2.5" />
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
                                  <MessageSquare className="h-2.5 w-2.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir no WhatsApp</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    )}
                    {lead.email && (
                      <div className="group flex items-center gap-2 rounded-md bg-muted/50 p-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate text-sm" title={lead.email}>
                          {lead.email}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => handleCopy(lead.email!, 'Email')}
                                aria-label="Copiar email"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar email</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                    {lead.cpf && (
                      <div className="group flex items-center gap-2 rounded-md bg-muted/50 p-2">
                        <span className="w-4 text-xs font-medium text-muted-foreground">CPF</span>
                        <span className="flex-1 text-sm">{maskCPF(lead.cpf)}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => handleCopy(lead.cpf!, 'CPF')}
                                aria-label="Copiar CPF"
                              >
                                <Copy className="h-2.5 w-2.5" />
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
                    <h4 className="text-xs font-medium uppercase text-muted-foreground">
                      Etiquetas
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.labels.map((label) => (
                        <Badge
                          key={label.id}
                          className={cn('border-0 text-xs', getContrastTextColor(label.color))}
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
                    <h4 className="text-xs font-medium uppercase text-muted-foreground">
                      Qualificação
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      {qualification.situacao && (
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground">Situação:</span>
                          <span className="min-w-0 break-words text-right">
                            {qualification.situacao}
                          </span>
                        </div>
                      )}
                      {qualification.condicao_saude && (
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground">Condição:</span>
                          <span className="min-w-0 break-words text-right">
                            {qualification.condicao_saude}
                          </span>
                        </div>
                      )}
                      {qualification.renda && (
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground">Renda:</span>
                          <span className="min-w-0 break-words text-right">
                            {qualification.renda}
                          </span>
                        </div>
                      )}
                      {qualification.idade && (
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground">Idade:</span>
                          <span className="min-w-0 break-words text-right">
                            {qualification.idade} anos
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Resumo do Caso - IA (Custom Field) - ACIMA de Informações */}
                {(() => {
                  const caseSummary = (lead as any).custom_fields?.case_summary;

                  // Função para renderizar texto formatado (markdown-like)
                  const renderFormattedText = (text: string) => {
                    const lines = text.split('\n');

                    return lines.map((line, lineIndex) => {
                      // Processar a linha
                      const processedLine = line;
                      const elements: React.ReactNode[] = [];
                      const lastIndex = 0;

                      // Regex para encontrar padrões
                      const patterns = [
                        {
                          regex: /\*\*(.+?)\*\*/g,
                          render: (match: string, p1: string) => (
                            <strong
                              key={`bold-${lineIndex}-${lastIndex}`}
                              className="font-semibold"
                            >
                              {p1}
                            </strong>
                          ),
                        },
                        {
                          regex: /\*([^*\n]+)\*/g,
                          render: (match: string, p1: string) => (
                            <strong
                              key={`bold2-${lineIndex}-${lastIndex}`}
                              className="font-semibold"
                            >
                              {p1}
                            </strong>
                          ),
                        },
                        {
                          regex: /_([^_\n]+)_/g,
                          render: (match: string, p1: string) => (
                            <em key={`italic-${lineIndex}-${lastIndex}`}>{p1}</em>
                          ),
                        },
                        {
                          regex: /\(?(https?:\/\/[^\s\)]+)\)?/g,
                          render: (match: string, p1: string) => (
                            <a
                              key={`link-${lineIndex}-${lastIndex}`}
                              href={p1}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {p1.length > 40 ? p1.substring(0, 40) + '...' : p1}
                            </a>
                          ),
                        },
                      ];

                      // Processar bold **text** e *text*
                      let result = processedLine;
                      result = result.replace(/\*\*(.+?)\*\*/g, '⟨⟨BOLD⟩⟩$1⟨⟨/BOLD⟩⟩');
                      result = result.replace(/\*([^*\n]+)\*/g, '⟨⟨BOLD⟩⟩$1⟨⟨/BOLD⟩⟩');
                      result = result.replace(/_([^_\n]+)_/g, '⟨⟨ITALIC⟩⟩$1⟨⟨/ITALIC⟩⟩');

                      // Converter marcadores para JSX
                      const parts = result.split(/(⟨⟨BOLD⟩⟩|⟨⟨\/BOLD⟩⟩|⟨⟨ITALIC⟩⟩|⟨⟨\/ITALIC⟩⟩)/);
                      let inBold = false;
                      let inItalic = false;

                      const renderedParts = parts
                        .map((part, partIndex) => {
                          if (part === '⟨⟨BOLD⟩⟩') {
                            inBold = true;
                            return null;
                          }
                          if (part === '⟨⟨/BOLD⟩⟩') {
                            inBold = false;
                            return null;
                          }
                          if (part === '⟨⟨ITALIC⟩⟩') {
                            inItalic = true;
                            return null;
                          }
                          if (part === '⟨⟨/ITALIC⟩⟩') {
                            inItalic = false;
                            return null;
                          }

                          if (!part) return null;

                          // Processar links dentro do texto
                          const linkRegex = /\(?(https?:\/\/[^\s\)]+)\)?/g;
                          const linkParts = part.split(linkRegex);

                          const content = linkParts.map((lp, lpIndex) => {
                            if (lp?.match(/^https?:\/\//)) {
                              return (
                                <a
                                  key={`link-${lineIndex}-${partIndex}-${lpIndex}`}
                                  href={lp}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  Link
                                </a>
                              );
                            }
                            return lp;
                          });

                          if (inBold) {
                            return (
                              <strong key={`b-${lineIndex}-${partIndex}`} className="font-semibold">
                                {content}
                              </strong>
                            );
                          }
                          if (inItalic) {
                            return <em key={`i-${lineIndex}-${partIndex}`}>{content}</em>;
                          }
                          return <span key={`s-${lineIndex}-${partIndex}`}>{content}</span>;
                        })
                        .filter(Boolean);

                      return (
                        <span key={lineIndex} className="block">
                          {renderedParts.length > 0 ? renderedParts : line}
                        </span>
                      );
                    });
                  };

                  return (
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-primary" />
                        Resumo do Caso - IA
                      </h4>
                      <div className="relative overflow-hidden rounded-lg border-l-4 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3">
                        {caseSummary && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1 h-6 w-6 opacity-50 transition-opacity hover:opacity-100"
                                  onClick={() => handleCopy(caseSummary, 'Resumo')}
                                  aria-label="Copiar resumo"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copiar resumo</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {caseSummary ? (
                          <div className="max-h-[300px] overflow-y-auto pr-6">
                            <div className="whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">
                              {renderFormattedText(caseSummary)}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm italic text-muted-foreground">
                            Nenhum resumo disponível
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Stage & Source */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase text-muted-foreground">
                    Informações
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    {lead.funnel_stages && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 text-muted-foreground">Etapa:</span>
                        <Badge
                          variant="outline"
                          className="max-w-[60%] truncate text-xs"
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
                        <span className="shrink-0 text-muted-foreground">Grupo:</span>
                        <span className="min-w-0 break-words text-right">
                          {lead.funnel_stages.grupo}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0 text-muted-foreground">Origem:</span>
                      <span className="min-w-0 break-words text-right">
                        {lead.source || 'Não informada'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0 text-muted-foreground">Criado:</span>
                      <span>
                        {lead.created_at
                          ? format(new Date(lead.created_at), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })
                          : 'Não informado'}
                      </span>
                    </div>
                    {lead.estimated_value && (
                      <div className="flex justify-between gap-2">
                        <span className="shrink-0 text-muted-foreground">Valor:</span>
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
          <TabsContent
            value="docs"
            className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
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
          <TabsContent
            value="ia"
            className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
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
                </Suspense>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent
            value="historico"
            className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-6 p-4">
                {/* Seção de Notas Internas */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-warning" />
                    <h3 className="text-sm font-medium">Notas Internas</h3>
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
                      <Activity className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Histórico de Atividades</h3>
                    </div>
                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                      <SelectTrigger className="h-7 w-[140px] text-xs">
                        <Filter className="mr-1 h-3 w-3" />
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
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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

// Memoize com comparação custom para evitar re-renders desnecessários
export const LeadDetailsPanel = memo(LeadDetailsPanelComponent, (prevProps, nextProps) => {
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.updated_at === nextProps.lead.updated_at &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.conversationId === nextProps.conversationId &&
    JSON.stringify(prevProps.lead.labels) === JSON.stringify(nextProps.lead.labels)
  );
});
