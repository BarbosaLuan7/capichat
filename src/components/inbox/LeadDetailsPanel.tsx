import { useState } from 'react';
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
  FileText,
  History,
  Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TransferLeadModal } from './TransferLeadModal';
import { LeadLabelsModal } from './LeadLabelsModal';
import { InternalNotes } from './InternalNotes';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Label = Database['public']['Tables']['labels']['Row'];

interface LeadDetailsPanelProps {
  lead: Lead & {
    funnel_stages?: { id: string; name: string; color: string; grupo?: string | null } | null;
    labels?: Label[];
  };
  conversationId: string;
  isFavorite?: boolean;
  onToggleFavorite: () => void;
  onTransfer: (userId: string) => void;
  onLabelsUpdate: () => void;
}

export function LeadDetailsPanel({
  lead,
  conversationId,
  isFavorite,
  onToggleFavorite,
  onTransfer,
  onLabelsUpdate,
}: LeadDetailsPanelProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openWhatsApp = () => {
    const phone = lead.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  const labelIds = lead.labels?.map((l) => l.id) || [];
  const qualification = (lead as any).qualification || {};

  // Timeline events based on lead data
  const timelineEvents = [
    {
      id: 'created',
      type: 'assigned' as const,
      title: 'Lead criado',
      description: `Origem: ${lead.source}`,
      createdAt: new Date(lead.created_at),
    },
  ];

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Lead Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="w-14 h-14">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`}
                />
                <AvatarFallback className="text-lg">
                  {lead.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute -right-1 -top-1 h-6 w-6 rounded-full bg-card border border-border',
                  isFavorite && 'text-warning'
                )}
                onClick={onToggleFavorite}
              >
                <Star
                  className={cn('w-3 h-3', isFavorite && 'fill-warning')}
                />
              </Button>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {lead.name}
              </h3>
              {(lead as any).whatsapp_name && (lead as any).whatsapp_name !== lead.name && (
                <p className="text-xs text-muted-foreground">
                  WhatsApp: {(lead as any).whatsapp_name}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  className={cn(
                    'text-xs',
                    lead.temperature === 'hot' &&
                      'bg-destructive/10 text-destructive',
                    lead.temperature === 'warm' && 'bg-warning/10 text-warning',
                    lead.temperature === 'cold' && 'bg-primary/10 text-primary'
                  )}
                >
                  {lead.temperature === 'hot'
                    ? '🔥 Quente'
                    : lead.temperature === 'warm'
                    ? '🌡️ Morno'
                    : '❄️ Frio'}
                </Badge>
                {lead.funnel_stages && (
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
                )}
              </div>
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
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={openWhatsApp}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger value="dados" className="text-xs gap-1 data-[state=active]:bg-muted">
              <User className="w-3 h-3" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs gap-1 data-[state=active]:bg-muted">
              <History className="w-3 h-3" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="notas" className="text-xs gap-1 data-[state=active]:bg-muted">
              <FileText className="w-3 h-3" />
              Notas
            </TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent value="dados" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <div className="p-4 space-y-4">
                {/* AI Summary */}
                {(lead as any).ai_summary && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-primary text-xs font-medium mb-2">
                      <Sparkles className="w-3 h-3" />
                      Resumo IA
                    </div>
                    <p className="text-sm text-foreground">
                      {(lead as any).ai_summary}
                    </p>
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
                      <span className="text-sm flex-1">{lead.phone}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleCopy(lead.phone, 'Telefone')}
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-success"
                          onClick={openWhatsApp}
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{lead.email}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopy(lead.email!, 'Email')}
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    )}
                    {lead.cpf && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                        <span className="text-xs font-medium text-muted-foreground w-4">
                          CPF
                        </span>
                        <span className="text-sm flex-1">{lead.cpf}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopy(lead.cpf!, 'CPF')}
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </Button>
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
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: label.color, color: label.color }}
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
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Situação:</span>
                          <span>{qualification.situacao}</span>
                        </div>
                      )}
                      {qualification.condicao_saude && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Condição:</span>
                          <span>{qualification.condicao_saude}</span>
                        </div>
                      )}
                      {qualification.renda && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Renda:</span>
                          <span>{qualification.renda}</span>
                        </div>
                      )}
                      {qualification.idade && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Idade:</span>
                          <span>{qualification.idade} anos</span>
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
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Etapa:</span>
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
                    {lead.funnel_stages?.grupo && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grupo:</span>
                        <span>{lead.funnel_stages.grupo}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origem:</span>
                      <span>{lead.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Criado:</span>
                      <span>
                        {format(new Date(lead.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {lead.estimated_value && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor:</span>
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

          {/* Histórico Tab */}
          <TabsContent value="historico" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <div className="p-4">
                <LeadTimeline events={timelineEvents} />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Notas Tab */}
          <TabsContent value="notas" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <div className="p-4">
                <InternalNotes conversationId={conversationId} />
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