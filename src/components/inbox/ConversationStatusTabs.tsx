import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, Clock, CheckCircle2, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  { 
    value: 'all', 
    label: 'Todas', 
    shortLabel: 'Todas',
    icon: Inbox, 
    colorClass: 'text-foreground', 
    badgeClass: 'bg-muted text-muted-foreground' 
  },
  { 
    value: 'open', 
    label: 'Abertas', 
    shortLabel: 'Abertas',
    icon: MessageCircle, 
    colorClass: 'text-success', 
    badgeClass: 'bg-success/15 text-success' 
  },
  { 
    value: 'pending', 
    label: 'Pendentes', 
    shortLabel: 'Pend.',
    icon: Clock, 
    colorClass: 'text-warning', 
    badgeClass: 'bg-warning/15 text-warning' 
  },
  { 
    value: 'resolved', 
    label: 'Resolvidas', 
    shortLabel: 'Resolv.',
    icon: CheckCircle2, 
    colorClass: 'text-muted-foreground', 
    badgeClass: 'bg-muted text-muted-foreground' 
  },
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
      <TabsList className="grid grid-cols-4 w-full bg-muted h-auto p-1 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = getCount(tab.value);
          const isActive = value === tab.value;
          
          return (
            <Tooltip key={tab.value}>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value={tab.value} 
                  className={cn(
                    "flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-all",
                    "hover:bg-background/50 active:scale-[0.98]",
                    "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                    isActive && tab.colorClass
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold tabular-nums">{count}</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tab.label}: {count} {count === 1 ? 'conversa' : 'conversas'}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
