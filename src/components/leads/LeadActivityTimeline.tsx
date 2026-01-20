import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, GitBranch, Thermometer, UserPlus, Tag, StickyNote, Edit, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadActivities, formatActivityMessage } from '@/hooks/useLeadActivities';
import { cn } from '@/lib/utils';

interface LeadActivityTimelineProps {
  leadId: string;
}

const getActivityIcon = (action: string) => {
  switch (action) {
    case 'lead_created':
      return Plus;
    case 'stage_changed':
      return GitBranch;
    case 'temperature_changed':
      return Thermometer;
    case 'assigned':
      return UserPlus;
    case 'label_added':
    case 'label_removed':
      return Tag;
    case 'note_added':
      return StickyNote;
    case 'updated':
      return Edit;
    default:
      return User;
  }
};

const getActivityColor = (action: string) => {
  switch (action) {
    case 'lead_created':
      return 'bg-activity-create';
    case 'stage_changed':
      return 'bg-activity-stage';
    case 'temperature_changed':
      return 'bg-activity-temp';
    case 'assigned':
      return 'bg-activity-assign';
    case 'label_added':
    case 'label_removed':
      return 'bg-activity-label';
    default:
      return 'bg-activity';
  }
};

export function LeadActivityTimeline({ leadId }: LeadActivityTimelineProps) {
  const { data: activities, isLoading } = useLeadActivities(leadId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">Nenhuma atividade registrada</div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute bottom-0 left-4 top-0 w-px bg-border" />

      <div className="space-y-6">
        {activities.map((activity, index) => {
          const Icon = getActivityIcon(activity.action);
          const colorClass = getActivityColor(activity.action);
          const message = formatActivityMessage(activity.action, activity.details || {});

          return (
            <div key={activity.id} className="relative flex gap-4 pl-2">
              {/* Icon */}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white',
                  colorClass
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{message}</p>
                    {activity.profiles && (
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={activity.profiles.avatar || undefined} />
                          <AvatarFallback className="text-2xs">
                            {activity.profiles.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {activity.profiles.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <time className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(activity.created_at), "dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </time>
                </div>

                {/* Additional details */}
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                    {activity.action === 'stage_changed' && activity.details.from_stage && (
                      <span>De "{activity.details.from_stage}"</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
