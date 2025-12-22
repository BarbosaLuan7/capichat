import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/appStore';
import { Task } from '@/types';
import { mockUsers, mockLeads } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { TaskModal } from '@/components/tasks/TaskModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { toast } from '@/hooks/use-toast';

const Calendar = () => {
  const { tasks, addTask, updateTask, deleteTask } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, day));
  };

  const selectedDayTasks = selectedDate ? getTasksForDay(selectedDate) : [];

  const getPriorityColor = (priority: Task['priority']) => {
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

  const getPriorityLabel = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'Urgente';
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
    }
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt'> & { id?: string }) => {
    if (taskData.id) {
      updateTask(taskData.id, taskData);
      toast({
        title: 'Tarefa atualizada',
        description: 'As alterações foram salvas.',
      });
    } else {
      addTask({
        ...taskData,
        dueDate: selectedDate || taskData.dueDate,
      });
      toast({
        title: 'Tarefa criada',
        description: 'Nova tarefa adicionada com sucesso.',
      });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
    toast({
      title: 'Tarefa excluída',
      description: 'A tarefa foi removida com sucesso.',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Calendário' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground">
            Visualize suas tarefas por data
          </p>
        </div>
        <Button onClick={handleNewTask} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
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
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <motion.button
                    key={day.toISOString()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'aspect-square p-1 border rounded-lg transition-colors min-h-[80px] text-left',
                      isSelected && 'ring-2 ring-primary border-primary',
                      isToday(day) && !isSelected && 'bg-primary/5 border-primary/50',
                      !isToday(day) && !isSelected && 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        isToday(day) ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </div>

                    {dayTasks.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <span
                            key={task.id}
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              getPriorityColor(task.priority)
                            )}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayTasks.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                  : 'Selecione um dia'}
              </span>
              {selectedDate && (
                <Badge variant="secondary">{selectedDayTasks.length} tarefas</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {selectedDayTasks.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayTasks.map((task) => {
                    const assignee = mockUsers.find((u) => u.id === task.assignedTo);
                    const lead = task.leadId
                      ? mockLeads.find((l) => l.id === task.leadId)
                      : null;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg border border-border hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleEditTask(task)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full mt-2 shrink-0',
                              getPriorityColor(task.priority)
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <h4
                              className={cn(
                                'font-medium text-foreground mb-1',
                                task.status === 'done' &&
                                  'line-through text-muted-foreground'
                              )}
                            >
                              {task.title}
                            </h4>

                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                              <Badge
                                variant="outline"
                                className="text-xs"
                              >
                                {getPriorityLabel(task.priority)}
                              </Badge>

                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(task.dueDate, 'HH:mm')}
                                </span>
                              )}

                              {lead && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {lead.name}
                                </span>
                              )}

                              {task.status === 'done' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">
                    Nenhuma tarefa
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Não há tarefas agendadas para este dia
                  </p>
                  <Button onClick={handleNewTask} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Tarefa
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={selectedTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
};

export default Calendar;
