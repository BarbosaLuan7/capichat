import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, CheckCircle2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

interface ConversationStatusTabsProps {
  value: ConversationStatus | 'all';
  onChange: (status: ConversationStatus | 'all') => void;
  counts: {
    all: number;
    open: number;
    pending: number;
    resolved: number;
  };
}

export function ConversationStatusTabs({ value, onChange, counts }: ConversationStatusTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ConversationStatus | 'all')}>
      <TabsList className="w-full bg-muted relative z-10 overflow-hidden">
        <TabsTrigger value="all" className="flex-1 min-w-0 text-xs gap-1.5 overflow-hidden">
          <span className="truncate">Todas</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium shrink-0">
            {counts.all}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="open" className="flex-1 min-w-0 text-xs gap-1.5 overflow-hidden">
          <MessageCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">Abertas</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-success/10 text-success shrink-0">
            {counts.open}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="pending" className="flex-1 min-w-0 text-xs gap-1.5 overflow-hidden">
          <Clock className="w-3 h-3 shrink-0" />
          <span className="truncate">Pendentes</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-warning/10 text-warning shrink-0">
            {counts.pending}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="resolved" className="flex-1 min-w-0 text-xs gap-1.5 overflow-hidden">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span className="truncate">Resolvidas</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-muted-foreground/10 text-muted-foreground shrink-0">
            {counts.resolved}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
