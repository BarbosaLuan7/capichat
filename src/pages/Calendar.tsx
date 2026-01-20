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
import { ChevronLeft, ChevronRight, Plus, Clock, User, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useLeads } from '@/hooks/useLeads';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { TaskModal } from '@/components/tasks/TaskModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { toast } from 'sonner';

type DbTask = Database['public']['Tables']['tasks']['Row'];
type TaskPriority = Database['public']['Enums']['task_priority'];
type TaskStatus = Database['public']['Enums']['task_status'];

const Calendar = () => {
  const { data: tasksData, isLoading: tasksLoading } = useAllTasks();
  const { data: profiles } = useProfiles();
  const { data: leadsData } = useLeads();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const tasks = tasksData || [];
  const leads = leadsData?.leads || [];

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DbTask | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => task.due_date && isSameDay(new Date(task.due_date), day));
  };

  const selectedDayTasks = selectedDate ? getTasksForDay(selectedDate) : [];

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

  const getPriorityLabel = (priority: TaskPriority) => {
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

  const handleEditTask = (task: DbTask) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleSaveTask = async (taskData: {
    id?: string;
    title: string;
    description?: string;
    leadId?: string;
    assignedTo: string;
    dueDate?: Date;
    priority: TaskPriority;
    status: TaskStatus;
    subtasks?: { id: string; title: string; completed: boolean }[];
  }) => {
    try {
      if (taskData.id) {
        await updateTask.mutateAsync({
          id: taskData.id,
          title: taskData.title,
          description: taskData.description || null,
          lead_id: taskData.leadId || null,
          assigned_to: taskData.assignedTo,
          due_date: taskData.dueDate?.toISOString() || null,
          priority: taskData.priority,
          status: taskData.status,
          subtasks: taskData.subtasks || [],
        });
        toast.success('Tarefa atualizada', {
          description: 'As alterações foram salvas.',
        });
      } else {
        await createTask.mutateAsync({
          title: taskData.title,
          description: taskData.description || null,
          lead_id: taskData.leadId || null,
          assigned_to: taskData.assignedTo,
          due_date: selectedDate?.toISOString() || taskData.dueDate?.toISOString() || null,
          priority: taskData.priority,
          status: taskData.status,
          subtasks: taskData.subtasks || [],
        });
        toast.success('Tarefa criada', {
          description: 'Nova tarefa adicionada com sucesso.',
        });
      }
      setModalOpen(false);
    } catch (error) {
      toast.error('Erro', {
        description: 'Não foi possível salvar a tarefa.',
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success('Tarefa excluída', {
        description: 'A tarefa foi removida com sucesso.',
      });
      setModalOpen(false);
    } catch (error) {
      toast.error('Erro', {
        description: 'Não foi possível excluir a tarefa.',
      });
    }
  };

  // Convert DB task to modal format
  const convertTaskForModal = (task: DbTask | null) => {
    if (!task) return null;
    return {
      id: task.id,
      title: task.title,
      description: task.description || undefined,
      leadId: task.lead_id || undefined,
      assignedTo: task.assigned_to,
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      priority: task.priority,
      status: task.status,
      createdAt: new Date(task.created_at),
      subtasks: (task.subtasks as { id: string; title: string; completed: boolean }[]) || [],
    };
  };

  if (tasksLoading) {
    return (
      <div className="space-y-6 p-6">
        <PageBreadcrumb items={[{ label: 'Calendário' }]} />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-[500px] lg:col-span-2" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb items={[{ label: 'Calendário' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground">Visualize suas tarefas por data</p>
        </div>
        <Button onClick={handleNewTask} className="gradient-primary gap-2 text-primary-foreground">
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {/* Month Navigation */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold capitalize text-foreground">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
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
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Week days header */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-sm font-medium text-muted-foreground"
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
                      'aspect-square min-h-[80px] rounded-lg border p-1 text-left transition-colors',
                      isSelected && 'border-primary ring-2 ring-primary',
                      isToday(day) && !isSelected && 'border-primary/50 bg-primary/5',
                      !isToday(day) && !isSelected && 'border-border hover:bg-muted/50'
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

                    {dayTasks.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <span
                            key={task.id}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              getPriorityColor(task.priority)
                            )}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-2xs text-muted-foreground">
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
              {selectedDate && <Badge variant="secondary">{selectedDayTasks.length} tarefas</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {selectedDayTasks.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayTasks.map((task) => {
                    const assignee = profiles?.find((u) => u.id === task.assigned_to);
                    const lead = task.lead_id ? leads.find((l) => l.id === task.lead_id) : null;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="cursor-pointer rounded-lg border border-border p-3 transition-shadow hover:shadow-md"
                        onClick={() => handleEditTask(task)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-2 h-2 w-2 shrink-0 rounded-full',
                              getPriorityColor(task.priority)
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <h4
                              className={cn(
                                'mb-1 font-medium text-foreground',
                                task.status === 'done' && 'text-muted-foreground line-through'
                              )}
                            >
                              {task.title}
                            </h4>

                            {task.description && (
                              <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {getPriorityLabel(task.priority)}
                              </Badge>

                              {task.due_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(task.due_date), 'HH:mm')}
                                </span>
                              )}

                              {lead && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {lead.name}
                                </span>
                              )}

                              {task.status === 'done' && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 font-medium text-foreground">Nenhuma tarefa</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Não há tarefas agendadas para este dia
                  </p>
                  <Button onClick={handleNewTask} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
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
        task={convertTaskForModal(selectedTask)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
};

export default Calendar;
