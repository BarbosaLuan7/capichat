import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreVertical, Monitor, Smartphone, Bot, MessageCircle, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type MessageStatus = 'sent' | 'delivered' | 'read' | 'pending' | 'failed';

interface MessageDetailsPopoverProps {
  source: string | null;
  status: MessageStatus;
  createdAt: string;
  isAgent: boolean;
}

// Source configuration with icons and colors
const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; colorClass: string }> = {
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
const STATUS_LABELS: Record<MessageStatus, string> = {
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  pending: 'Enviando',
  failed: 'Falhou',
};

export function MessageDetailsPopover({ 
  source, 
  status, 
  createdAt, 
  isAgent 
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
            "p-1 rounded-full transition-colors",
            isAgent 
              ? "text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/10" 
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
          )}
          aria-label="Detalhes da mensagem"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3" 
        side={isAgent ? "left" : "right"}
        align="start"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-foreground">Detalhes</h4>
          <Badge 
            variant={status === 'read' ? 'success' : status === 'failed' ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {STATUS_LABELS[status]}
          </Badge>
        </div>

        {/* Timestamp */}
        <div className="mb-3">
          <span className="text-xs text-muted-foreground block mb-1">Criada em</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formattedDate}</span>
            <span className="text-sm text-muted-foreground">{formattedTime}</span>
          </div>
        </div>

        {/* Origin - only show for outbound messages (isAgent) */}
        {isAgent && (
          <div>
            <span className="text-xs text-muted-foreground block mb-1.5">Origem</span>
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", config.colorClass)} />
              <SourceIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">{config.label}</span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
