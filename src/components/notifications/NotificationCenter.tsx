import { useState } from 'react';
import {
  Bell,
  CheckCheck,
  User,
  ClipboardList,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  userId?: string;
}

// Tipos focados em notificações administrativas/importantes
const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  task: ClipboardList,
  lead: User,
  contract: FileText,
  system: Bell,
};

const typeColors: Record<string, string> = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
  task: 'text-accent',
  lead: 'text-warning',
  contract: 'text-success',
  system: 'text-primary',
};

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useNotifications(userId);
  const { data: unreadCount = 0 } = useUnreadNotificationsCount(userId);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }

    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    if (userId) {
      markAllRead.mutate(userId);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <Popover open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Notificações</TooltipContent>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b p-4">
              <h4 className="font-semibold">Notificações</h4>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck className="mr-1 h-4 w-4" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>

            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">Carregando...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => {
                    const Icon = typeIcons[notification.type] || Info;
                    const colorClass = typeColors[notification.type] || 'text-muted-foreground';

                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'w-full p-4 text-left transition-colors hover:bg-muted/50',
                          !notification.read && 'bg-muted/30'
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn('mt-0.5', colorClass)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={cn(
                                  'text-sm font-medium',
                                  !notification.read && 'text-foreground',
                                  notification.read && 'text-muted-foreground'
                                )}
                              >
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  );
}
