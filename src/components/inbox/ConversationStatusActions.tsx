import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, Clock, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

interface ConversationStatusActionsProps {
  currentStatus: ConversationStatus;
  onStatusChange: (status: ConversationStatus) => void;
  isLoading?: boolean;
}

const statusConfig: Record<
  ConversationStatus,
  { label: string; icon: typeof MessageCircle; className: string }
> = {
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

function ConversationStatusActionsComponent({
  currentStatus,
  onStatusChange,
  isLoading,
}: ConversationStatusActionsProps) {
  const current = statusConfig[currentStatus];
  const StatusIcon = current.icon;

  const handleStatusChange = useCallback(
    (status: ConversationStatus) => {
      if (status === currentStatus) return;
      onStatusChange(status);
      toast.success(`Status alterado para ${statusConfig[status].label}`);
    },
    [currentStatus, onStatusChange]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 gap-1.5', current.className)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <StatusIcon className="h-3.5 w-3.5" />
          )}
          {current.label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleStatusChange('open')}
          disabled={isLoading}
          className={cn(currentStatus === 'open' && 'bg-muted')}
        >
          <MessageCircle className="mr-2 h-4 w-4 text-success" />
          <span>Aberta</span>
          {currentStatus === 'open' && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusChange('pending')}
          disabled={isLoading}
          className={cn(currentStatus === 'pending' && 'bg-muted')}
        >
          <Clock className="mr-2 h-4 w-4 text-warning" />
          <span>Pendente</span>
          {currentStatus === 'pending' && <CheckCircle2 className="ml-auto h-4 w-4 text-warning" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleStatusChange('resolved')}
          disabled={isLoading}
          className={cn(currentStatus === 'resolved' && 'bg-muted')}
        >
          <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Marcar como Resolvida</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const ConversationStatusActions = memo(
  ConversationStatusActionsComponent,
  (prev, next) => prev.currentStatus === next.currentStatus && prev.isLoading === next.isLoading
);
