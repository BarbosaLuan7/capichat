import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type DbTask = Database['public']['Tables']['tasks']['Row'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface TaskCalendarProps {
  tasks: DbTask[];
  onTaskClick: (task: DbTask) => void;
}

export const TaskCalendar = ({ tasks, onTaskClick }: TaskCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => task.due_date && isSameDay(new Date(task.due_date), day));
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-destructive';
      case 'high':
        return 'bg-warning';
      case 'medium':
        return 'bg-primary';
      case 'low':
        return 'bg-muted-foreground';
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold capitalize text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
              }
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
              }
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week days header */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {days.map((day) => {
            const dayTasks = getTasksForDay(day);
            const hasMore = dayTasks.length > 2;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'aspect-square min-h-[100px] rounded-lg border p-1 transition-colors',
                  isToday(day) && 'border-primary bg-primary/5',
                  !isToday(day) && 'border-border hover:bg-muted/50'
                )}
              >
                <div
                  className={cn(
                    'mb-1 text-sm font-medium',
                    isToday(day) ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  {dayTasks.slice(0, 2).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        'w-full truncate rounded p-1 text-left text-xs',
                        'transition-opacity hover:opacity-80',
                        task.status === 'done' ? 'bg-success/20 text-success' : 'bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            getPriorityColor(task.priority)
                          )}
                        />
                        <span className="truncate">{task.title}</span>
                      </div>
                    </button>
                  ))}

                  {hasMore && (
                    <div className="pl-1 text-xs text-muted-foreground">
                      +{dayTasks.length - 2} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
