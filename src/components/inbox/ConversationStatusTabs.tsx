import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, Clock, CheckCircle2, Inbox } from 'lucide-react';
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

const tabs = [
  { value: 'all', label: 'Todas', icon: Inbox, colorClass: '' },
  { value: 'open', label: 'Abertas', icon: MessageCircle, colorClass: 'bg-success/10 text-success' },
  { value: 'pending', label: 'Pendentes', icon: Clock, colorClass: 'bg-warning/10 text-warning' },
  { value: 'resolved', label: 'Resolvidas', icon: CheckCircle2, colorClass: 'bg-muted-foreground/10 text-muted-foreground' },
] as const;

export function ConversationStatusTabs({ value, onChange, counts }: ConversationStatusTabsProps) {
  const getCount = (tabValue: string) => {
    switch (tabValue) {
      case 'all': return counts.all;
      case 'open': return counts.open;
      case 'pending': return counts.pending;
      case 'resolved': return counts.resolved;
      default: return 0;
    }
  };

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ConversationStatus | 'all')}>
      <TabsList className="grid grid-cols-4 w-full bg-muted">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = getCount(tab.value);
          
          return (
            <Tooltip key={tab.value}>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value={tab.value} 
                  className="px-1 py-1.5 text-[11px] gap-0.5 justify-center"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xl:inline truncate max-w-[50px]">{tab.label}</span>
                  <Badge 
                    variant="secondary" 
                    className={`px-1 py-0 text-[10px] font-medium shrink-0 min-w-[18px] ${tab.colorClass}`}
                  >
                    {count}
                  </Badge>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {tab.label}: {count}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
