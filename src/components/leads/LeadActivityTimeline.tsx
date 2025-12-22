import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User,
  GitBranch,
  Thermometer,
  UserPlus,
  Tag,
  StickyNote,
  Edit,
  Plus,
} from 'lucide-react';
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
      return 'bg-green-500';
    case 'stage_changed':
      return 'bg-blue-500';
    case 'temperature_changed':
      return 'bg-orange-500';
    case 'assigned':
      return 'bg-purple-500';
    case 'label_added':
    case 'label_removed':
      return 'bg-pink-500';
    default:
      return 'bg-gray-500';
  }
};

export function LeadActivityTimeline({ leadId }: LeadActivityTimelineProps) {
  const { data: activities, isLoading } = useLeadActivities(leadId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
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
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma atividade registrada
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

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
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-white',
                  colorClass
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {message}
                    </p>
                    {activity.profiles && (
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={activity.profiles.avatar || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {activity.profiles.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {activity.profiles.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.created_at), "dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </time>
                </div>

                {/* Additional details */}
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
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
