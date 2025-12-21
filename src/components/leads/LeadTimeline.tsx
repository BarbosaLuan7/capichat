import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageSquare,
  ArrowRight,
  Tag,
  UserCheck,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  type: 'message' | 'stage_change' | 'label_added' | 'assigned' | 'task_completed' | 'note';
  title: string;
  description?: string;
  createdAt: Date;
  user?: string;
}

interface LeadTimelineProps {
  events: TimelineEvent[];
}

export const LeadTimeline = ({ events }: LeadTimelineProps) => {
  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'message':
        return MessageSquare;
      case 'stage_change':
        return ArrowRight;
      case 'label_added':
        return Tag;
      case 'assigned':
        return UserCheck;
      case 'task_completed':
        return CheckCircle2;
      case 'note':
        return FileText;
      default:
        return Clock;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'message':
        return 'text-primary bg-primary/10';
      case 'stage_change':
        return 'text-warning bg-warning/10';
      case 'label_added':
        return 'text-accent bg-accent/10';
      case 'assigned':
        return 'text-info bg-info/10';
      case 'task_completed':
        return 'text-success bg-success/10';
      case 'note':
        return 'text-muted-foreground bg-muted';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="relative space-y-4">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      {events.map((event, index) => {
        const Icon = getEventIcon(event.type);
        const colorClass = getEventColor(event.type);

        return (
          <div key={event.id} className="relative flex gap-4 pl-1">
            {/* Icon */}
            <div className={cn(
              'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              colorClass
            )}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                  {event.user && (
                    <p className="text-xs text-muted-foreground mt-1">por {event.user}</p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(event.createdAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </time>
              </div>
            </div>
          </div>
        );
      })}

      {events.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma atividade registrada</p>
        </div>
      )}
    </div>
  );
};
