import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  MoreVertical,
  User,
  ListTodo,
  LayoutGrid,
  Calendar as CalendarIcon,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTasks, useUpdateTaskStatus, useDeleteTask, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useLeads } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskCalendar } from '@/components/tasks/TaskCalendar';
import { SubtaskList } from '@/components/tasks/SubtaskList';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { toast } from 'sonner';

import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

// Use any for flexible typing with Supabase data
type TaskFromDB = any;

interface TaskCardProps {
  task: TaskFromDB;
  onStatusChange: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSubtaskToggle?: (subtaskId: string, completed: boolean) => void;
  isDragging?: boolean;
}

const getPriorityColor = (priority: TaskPriority) => {
  switch (priority) {
    case 'urgent':
      return 'bg-destructive text-destructive-foreground';
    case 'high':
      return 'bg-warning text-warning-foreground';
    case 'medium':
      return 'bg-primary text-primary-foreground';
    case 'low':
      return 'bg-muted text-muted-foreground';
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

const formatDueDate = (dateStr: string) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  return format(date, "dd 'de' MMM", { locale: ptBR });
};

const SortableTaskCard = ({ task, onStatusChange, onEdit, onDelete, onSubtaskToggle }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
        onSubtaskToggle={onSubtaskToggle}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

interface TaskCardWithDragProps extends TaskCardProps {
  dragHandleProps?: Record<string, any>;
}

const TaskCard = ({ task, onStatusChange, onEdit, onDelete, onSubtaskToggle, isDragging, dragHandleProps }: TaskCardWithDragProps) => {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done';
  const subtasks = (task.subtasks as Subtask[]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className={cn(
        'hover:shadow-md transition-shadow',
        isOverdue && 'border-destructive/50',
        isDragging && 'shadow-lg ring-2 ring-primary/20'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {dragHandleProps && (
              <div
                {...dragHandleProps}
                className="mt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            
            <Checkbox
              checked={task.status === 'done'}
              onCheckedChange={(checked) => onStatusChange(checked ? 'done' : 'todo')}
              className="mt-1"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className={cn(
                  'font-medium text-foreground',
                  task.status === 'done' && 'line-through text-muted-foreground'
                )}>
                  {task.title}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {task.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {task.description}
                </p>
              )}

              {/* Subtasks */}
              {subtasks.length > 0 && (
                <div className="mb-3">
                  <SubtaskList
                    subtasks={subtasks}
                    onToggle={onSubtaskToggle}
                    compact
                  />
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap text-sm">
                <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                  {getPriorityLabel(task.priority)}
                </Badge>

                {task.due_date && (
                  <div className={cn(
                    'flex items-center gap-1',
                    isOverdue ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDueDate(task.due_date)}</span>
                  </div>
                )}

                {task.leads && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[100px]">{task.leads.name}</span>
                  </div>
                )}

                {task.profiles && (
                  <Avatar className="w-6 h-6 ml-auto">
                    <AvatarImage src={task.profiles.avatar || undefined} />
                    <AvatarFallback className="text-xs">{task.profiles.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const Tasks = () => {
  const { data: tasks, isLoading } = useTasks();
  const { data: profiles } = useProfiles();
  const { data: leads } = useLeads();
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const createTask = useCreateTask();
  
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskFromDB | null>(null);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskFromDB | null>(null);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      const matchesFilter = filter === 'all' || task.status === filter;
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [tasks, filter, searchQuery]);

  const tasksByStatus = useMemo(() => ({
    todo: (tasks || []).filter((t) => t.status === 'todo') as TaskFromDB[],
    in_progress: (tasks || []).filter((t) => t.status === 'in_progress') as TaskFromDB[],
    done: (tasks || []).filter((t) => t.status === 'done') as TaskFromDB[],
  }), [tasks]);

  const statusConfig = {
    todo: { label: 'A Fazer', icon: Circle, color: 'text-muted-foreground' },
    in_progress: { label: 'Em Andamento', icon: AlertCircle, color: 'text-warning' },
    done: { label: 'Concluídas', icon: CheckCircle2, color: 'text-success' },
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setModalOpen(true);
  };

  const handleEditTask = (task: TaskFromDB) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleDeleteClick = (task: TaskFromDB) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (taskToDelete) {
      try {
        await deleteTaskMutation.mutateAsync(taskToDelete.id);
        toast.success('Tarefa excluída');
      } catch (error) {
        toast.error('Erro ao excluir tarefa');
      }
    }
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
  };

  const handleSaveTask = async (taskData: any) => {
    try {
      if (taskData.id) {
        await updateTask.mutateAsync(taskData);
        toast.success('Tarefa atualizada');
      } else {
        await createTask.mutateAsync(taskData);
        toast.success('Tarefa criada');
      }
      setModalOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar tarefa');
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateStatus.mutateAsync({ taskId, status });
      if (status === 'done') {
        toast.success('Tarefa concluída!');
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSubtaskToggle = async (task: TaskFromDB, subtaskId: string, completed: boolean) => {
    const subtasks = (task.subtasks as Subtask[]) || [];
    const updatedSubtasks = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed } : s
    );
    try {
      await updateTask.mutateAsync({
        id: task.id,
        subtasks: updatedSubtasks as any,
      });
    } catch (error) {
      toast.error('Erro ao atualizar subtarefa');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks?.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Determine target status from the over element
    let targetStatus: TaskStatus | null = null;

    // Check if dropped over a column (droppable area)
    if (over.id === 'todo' || over.id === 'in_progress' || over.id === 'done') {
      targetStatus = over.id as TaskStatus;
    } else {
      // Dropped over another task - get its status
      const overTask = tasks?.find((t) => t.id === over.id);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus && targetStatus !== activeTask.status) {
      try {
        await updateStatus.mutateAsync({ taskId: activeTask.id, status: targetStatus });
        toast.success(`Tarefa movida para "${statusConfig[targetStatus].label}"`);
      } catch (error) {
        toast.error('Erro ao mover tarefa');
      }
    }
  };

  const activeTask = activeId ? tasks?.find((t) => t.id === activeId) as TaskFromDB : null;

  // Convert TaskFromDB to Task format for modal/calendar
  const convertToTaskFormat = (t: TaskFromDB) => ({
    id: t.id,
    title: t.title,
    description: t.description || undefined,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date ? parseISO(t.due_date) : undefined,
    assignedTo: t.assigned_to,
    leadId: t.lead_id || undefined,
    subtasks: (t.subtasks as Subtask[]) || [],
    createdAt: parseISO(t.created_at),
  });

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Tarefas' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">
            {tasks?.length || 0} tarefas · {tasksByStatus.todo.length} pendentes
          </p>
        </div>
        <Button onClick={handleNewTask} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="todo">A Fazer</TabsTrigger>
            <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
            <TabsTrigger value="done">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('list')}
          >
            <ListTodo className="w-4 h-4" />
          </Button>
          <Button
            variant={view === 'kanban' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={view === 'calendar' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('calendar')}
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando tarefas...</div>
      ) : view === 'calendar' ? (
        <TaskCalendar 
          tasks={(tasks || []).map(convertToTaskFormat)} 
          onTaskClick={(t) => {
            const original = tasks?.find(task => task.id === t.id);
            if (original) handleEditTask(original as TaskFromDB);
          }} 
        />
      ) : view === 'list' ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task as TaskFromDB}
              onStatusChange={(status) => handleStatusChange(task.id, status)}
              onEdit={() => handleEditTask(task as TaskFromDB)}
              onDelete={() => handleDeleteClick(task as TaskFromDB)}
              onSubtaskToggle={(subtaskId, completed) => handleSubtaskToggle(task as TaskFromDB, subtaskId, completed)}
            />
          ))}

          {filteredTasks.length === 0 && (
            <Card className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Nenhuma tarefa encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  {filter === 'all' ? 'Crie uma nova tarefa para começar' : 'Não há tarefas nesta categoria'}
                </p>
                <Button onClick={handleNewTask} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Tarefa
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.keys(tasksByStatus) as Array<keyof typeof tasksByStatus>).map((status) => {
              const config = statusConfig[status];
              const statusTasks = tasksByStatus[status];

              return (
                <div key={status} id={status}>
                  <div className="flex items-center gap-2 mb-4">
                    <config.icon className={cn('w-5 h-5', config.color)} />
                    <h3 className="font-semibold text-foreground">{config.label}</h3>
                    <Badge variant="secondary">{statusTasks.length}</Badge>
                  </div>

                  <SortableContext
                    items={statusTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div 
                      className={cn(
                        "space-y-3 min-h-[200px] p-2 rounded-lg transition-colors",
                        activeId && "bg-muted/30"
                      )}
                      data-status={status}
                    >
                      {statusTasks.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                          onEdit={() => handleEditTask(task)}
                          onDelete={() => handleDeleteClick(task)}
                          onSubtaskToggle={(subtaskId, completed) => handleSubtaskToggle(task, subtaskId, completed)}
                        />
                      ))}

                      {statusTasks.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                          <p className="text-sm">Arraste tarefas aqui</p>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <TaskCard
                task={activeTask}
                onStatusChange={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={selectedTask ? convertToTaskFormat(selectedTask) : null}
        onSave={handleSaveTask}
        onDelete={(id) => {
          deleteTaskMutation.mutate(id);
          toast.success('Tarefa excluída');
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa "{taskToDelete?.title}" será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tasks;
