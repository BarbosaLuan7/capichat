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
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TransferLeadModal } from './TransferLeadModal';
import { LeadLabelsModal } from './LeadLabelsModal';
import { InternalNotes } from './InternalNotes';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Label = Database['public']['Tables']['labels']['Row'];

interface LeadDetailsPanelProps {
  lead: Lead & {
    funnel_stages?: { id: string; name: string; color: string } | null;
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

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-6">
          {/* Lead Info */}
          <div className="text-center">
            <div className="relative inline-block">
              <Avatar className="w-20 h-20 mx-auto mb-3">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`}
                />
                <AvatarFallback className="text-2xl">
                  {lead.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute -right-2 -top-2 h-8 w-8 rounded-full bg-card border border-border',
                  isFavorite && 'text-warning'
                )}
                onClick={onToggleFavorite}
              >
                <Star
                  className={cn('w-4 h-4', isFavorite && 'fill-warning')}
                />
              </Button>
            </div>
            <h3 className="font-semibold text-lg text-foreground">
              {lead.name}
            </h3>
            <Badge
              className={cn(
                'mt-2',
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
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowTransferModal(true)}
            >
              <UserPlus className="w-4 h-4" />
              Transferir
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowLabelsModal(true)}
            >
              <Tag className="w-4 h-4" />
              Etiquetar
            </Button>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              CONTATO
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 group">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm flex-1">{lead.phone}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(lead.phone, 'Telefone')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success"
                    onClick={openWhatsApp}
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {lead.email && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 group">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{lead.email}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleCopy(lead.email!, 'Email')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {lead.cpf && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 group">
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    CPF
                  </span>
                  <span className="text-sm flex-1">{lead.cpf}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleCopy(lead.cpf!, 'CPF')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Labels */}
          {lead.labels && lead.labels.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                ETIQUETAS
              </h4>
              <div className="flex flex-wrap gap-2">
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

          {/* Stage */}
          {lead.funnel_stages && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                ETAPA DO FUNIL
              </h4>
              <Badge
                style={{
                  backgroundColor: lead.funnel_stages.color + '20',
                  color: lead.funnel_stages.color,
                  borderColor: lead.funnel_stages.color,
                }}
              >
                {lead.funnel_stages.name}
              </Badge>
            </div>
          )}

          <Separator />

          {/* Internal Notes */}
          <InternalNotes conversationId={conversationId} />

          <Separator />

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              HISTÓRICO
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-muted-foreground">Criado em</span>
                <span className="ml-auto">
                  {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Origem</span>
                <span className="ml-auto">{lead.source}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

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
