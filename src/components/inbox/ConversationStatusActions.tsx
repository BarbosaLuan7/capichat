import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

interface ConversationStatusActionsProps {
  currentStatus: ConversationStatus;
  onStatusChange: (status: ConversationStatus) => void;
  isLoading?: boolean;
}

const statusConfig: Record<ConversationStatus, { label: string; icon: typeof MessageCircle; className: string }> = {
  open: {
    label: 'Aberta',
    icon: MessageCircle,
    className: 'text-success border-success/50 bg-success/10 hover:bg-success/20',
  },
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'text-warning border-warning/50 bg-warning/10 hover:bg-warning/20',
  },
  resolved: {
    label: 'Resolvida',
    icon: CheckCircle2,
    className: 'text-muted-foreground border-muted-foreground/50 bg-muted hover:bg-muted/80',
  },
};

export function ConversationStatusActions({ currentStatus, onStatusChange, isLoading }: ConversationStatusActionsProps) {
  const current = statusConfig[currentStatus];
  const StatusIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1.5 h-8', current.className)}
          disabled={isLoading}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {current.label}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onStatusChange('open')}
          className={cn(currentStatus === 'open' && 'bg-muted')}
        >
          <MessageCircle className="w-4 h-4 mr-2 text-success" />
          <span>Aberta</span>
          {currentStatus === 'open' && (
            <CheckCircle2 className="w-4 h-4 ml-auto text-success" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onStatusChange('pending')}
          className={cn(currentStatus === 'pending' && 'bg-muted')}
        >
          <Clock className="w-4 h-4 mr-2 text-warning" />
          <span>Pendente</span>
          {currentStatus === 'pending' && (
            <CheckCircle2 className="w-4 h-4 ml-auto text-warning" />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onStatusChange('resolved')}
          className={cn(currentStatus === 'resolved' && 'bg-muted')}
        >
          <CheckCircle2 className="w-4 h-4 mr-2 text-muted-foreground" />
          <span>Marcar como Resolvida</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
