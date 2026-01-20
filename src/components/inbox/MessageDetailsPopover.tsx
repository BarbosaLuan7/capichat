import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreVertical, Monitor, Smartphone, Bot, MessageCircle, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type MessageStatus = 'sent' | 'delivered' | 'read' | 'pending' | 'failed' | 'sending';

interface MessageDetailsPopoverProps {
  source: string | null;
  status: string; // Accept any status string for flexibility
  createdAt: string;
  isAgent: boolean;
}

// Source configuration with icons and colors
const SOURCE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  crm: {
    label: 'CRM',
    icon: Monitor,
    colorClass: 'bg-blue-500',
  },
  mobile: {
    label: 'Mobile',
    icon: Smartphone,
    colorClass: 'bg-green-500',
  },
  api: {
    label: 'API',
    icon: Bot,
    colorClass: 'bg-purple-500',
  },
  lead: {
    label: 'Lead',
    icon: MessageCircle,
    colorClass: 'bg-orange-500',
  },
  unknown: {
    label: 'WhatsApp',
    icon: MessageCircle,
    colorClass: 'bg-muted-foreground',
  },
};

// Status labels in Portuguese
const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  pending: 'Enviando',
  sending: 'Enviando',
  failed: 'Falhou',
};

export function MessageDetailsPopover({
  source,
  status,
  createdAt,
  isAgent,
}: MessageDetailsPopoverProps) {
  const sourceKey = source || 'unknown';
  const config = SOURCE_CONFIG[sourceKey] || SOURCE_CONFIG.unknown;
  const SourceIcon = config.icon;

  const formattedDate = format(new Date(createdAt), 'dd/MM/yyyy', { locale: ptBR });
  const formattedTime = format(new Date(createdAt), 'HH:mm:ss', { locale: ptBR });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'rounded-full p-1 transition-colors',
            isAgent
              ? 'text-primary-foreground/50 hover:bg-primary-foreground/10 hover:text-primary-foreground'
              : 'text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground'
          )}
          aria-label="Detalhes da mensagem"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side={isAgent ? 'left' : 'right'} align="start">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Detalhes</h4>
          <Badge
            variant={
              status === 'read' ? 'success' : status === 'failed' ? 'destructive' : 'secondary'
            }
            className="text-xs"
          >
            {STATUS_LABELS[status] || status}
          </Badge>
        </div>

        {/* Timestamp */}
        <div className="mb-3">
          <span className="mb-1 block text-xs text-muted-foreground">Criada em</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formattedDate}</span>
            <span className="text-sm text-muted-foreground">{formattedTime}</span>
          </div>
        </div>

        {/* Origin - only show for outbound messages (isAgent) */}
        {isAgent && (
          <div>
            <span className="mb-1.5 block text-xs text-muted-foreground">Origem</span>
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', config.colorClass)} />
              <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{config.label}</span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
