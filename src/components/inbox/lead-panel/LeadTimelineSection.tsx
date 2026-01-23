import { memo, useMemo, useState } from 'react';
import { Activity, Filter, Loader2 } from 'lucide-react';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { useLeadActivities, formatActivityMessage } from '@/hooks/useLeadActivities';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LeadWithRelations } from './types';

interface LeadTimelineSectionProps {
  lead: LeadWithRelations;
}

type EventType =
  | 'message'
  | 'stage_change'
  | 'label_added'
  | 'assigned'
  | 'task_completed'
  | 'note';

function LeadTimelineSectionComponent({ lead }: LeadTimelineSectionProps) {
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const { data: activities, isLoading: activitiesLoading } = useLeadActivities(lead.id);

  const getEventType = (action: string): EventType => {
    switch (action) {
      case 'stage_changed':
        return 'stage_change';
      case 'label_added':
      case 'label_removed':
        return 'label_added';
      case 'assigned':
        return 'assigned';
      case 'note_added':
        return 'note';
      case 'message_sent':
      case 'message_received':
        return 'message';
      default:
        return 'assigned';
    }
  };

  const allTimelineEvents = useMemo(() => {
    const events =
      activities?.map((activity) => ({
        id: activity.id,
        type: getEventType(activity.action),
        title: formatActivityMessage(activity.action, activity.details || {}),
        description: activity.details?.description || activity.details?.content,
        createdAt: new Date(activity.created_at),
        user: activity.profiles?.name,
      })) || [];

    // Always add lead creation event
    events.push({
      id: 'created',
      type: 'assigned' as const,
      title: 'Lead criado',
      description: `Origem: ${lead.source}`,
      createdAt: new Date(lead.created_at),
      user: undefined,
    });

    return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [activities, lead.source, lead.created_at]);

  const filteredEvents = useMemo(() => {
    if (activityFilter === 'all') return allTimelineEvents;
    return allTimelineEvents.filter((event) => event.type === activityFilter);
  }, [allTimelineEvents, activityFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Historico de Atividades</h3>
        </div>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <Filter className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="stage_change">Mudancas de etapa</SelectItem>
            <SelectItem value="label_added">Etiquetas</SelectItem>
            <SelectItem value="assigned">Atribuicoes</SelectItem>
            <SelectItem value="note">Notas</SelectItem>
            <SelectItem value="message">Mensagens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activitiesLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando historico...
        </div>
      ) : (
        <LeadTimeline events={filteredEvents} />
      )}
    </div>
  );
}

export const LeadTimelineSection = memo(LeadTimelineSectionComponent);
