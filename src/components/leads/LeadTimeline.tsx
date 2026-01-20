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
      <div className="absolute bottom-2 left-4 top-2 w-px bg-border" />

      {events.map((event, index) => {
        const Icon = getEventIcon(event.type);
        const colorClass = getEventColor(event.type);

        return (
          <div key={event.id} className="relative flex gap-4 pl-1">
            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                colorClass
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  {event.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
                  )}
                  {event.user && (
                    <p className="mt-1 text-xs text-muted-foreground">por {event.user}</p>
                  )}
                </div>
                <time className="whitespace-nowrap text-xs text-muted-foreground">
                  {format(event.createdAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </time>
              </div>
            </div>
          </div>
        );
      })}

      {events.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <Clock className="mx-auto mb-2 h-12 w-12 opacity-50" />
          <p>Nenhuma atividade registrada</p>
        </div>
      )}
    </div>
  );
};
