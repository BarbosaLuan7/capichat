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
      <TabsList className="w-full bg-muted relative z-10">
        <TabsTrigger value="all" className="flex-1 text-xs gap-1.5">
          Todas
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
            {counts.all}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="open" className="flex-1 text-xs gap-1.5">
          <MessageCircle className="w-3 h-3" />
          Abertas
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-success/10 text-success">
            {counts.open}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="pending" className="flex-1 text-xs gap-1.5">
          <Clock className="w-3 h-3" />
          Pendentes
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-warning/10 text-warning">
            {counts.pending}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="resolved" className="flex-1 text-xs gap-1.5">
          <CheckCircle2 className="w-3 h-3" />
          Resolvidas
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-muted-foreground/10 text-muted-foreground">
            {counts.resolved}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
