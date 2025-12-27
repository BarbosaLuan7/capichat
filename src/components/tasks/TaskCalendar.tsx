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
    return tasks.filter(task => task.due_date && isSameDay(new Date(task.due_date), day));
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {days.map(day => {
            const dayTasks = getTasksForDay(day);
            const hasMore = dayTasks.length > 2;
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'aspect-square p-1 border rounded-lg transition-colors min-h-[100px]',
                  isToday(day) && 'bg-primary/5 border-primary',
                  !isToday(day) && 'border-border hover:bg-muted/50'
                )}
              >
                <div className={cn(
                  'text-sm font-medium mb-1',
                  isToday(day) ? 'text-primary' : 'text-foreground'
                )}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-0.5 overflow-hidden">
                  {dayTasks.slice(0, 2).map(task => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        'w-full text-left text-xs p-1 rounded truncate',
                        'hover:opacity-80 transition-opacity',
                        task.status === 'done' ? 'bg-success/20 text-success' : 'bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getPriorityColor(task.priority))} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    </button>
                  ))}
                  
                  {hasMore && (
                    <div className="text-xs text-muted-foreground pl-1">
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
