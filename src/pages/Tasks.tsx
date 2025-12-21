import { useState } from 'react';
import { motion } from 'framer-motion';
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
import { useAppStore } from '@/store/appStore';
import { mockUsers, mockLeads } from '@/data/mockData';
import { Task } from '@/types';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskCalendar } from '@/components/tasks/TaskCalendar';
import { toast } from '@/hooks/use-toast';

interface TaskCardProps {
  task: Task;
  onStatusChange: (status: Task['status']) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const TaskCard = ({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) => {
  const assignee = mockUsers.find((u) => u.id === task.assignedTo);
  const lead = task.leadId ? mockLeads.find((l) => l.id === task.leadId) : null;
  const isOverdue = task.dueDate && isPast(task.dueDate) && task.status !== 'done';

  const getPriorityColor = (priority: Task['priority']) => {
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

  const formatDueDate = (date: Date) => {
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className={cn('hover:shadow-md transition-shadow', isOverdue && 'border-destructive/50')}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
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

              <div className="flex items-center gap-3 flex-wrap text-sm">
                <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                  {getPriorityLabel(task.priority)}
                </Badge>

                {task.dueDate && (
                  <div className={cn(
                    'flex items-center gap-1',
                    isOverdue ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDueDate(task.dueDate)}</span>
                  </div>
                )}

                {lead && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[100px]">{lead.name}</span>
                  </div>
                )}

                {assignee && (
                  <Avatar className="w-6 h-6 ml-auto">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="text-xs">{assignee.name.charAt(0)}</AvatarFallback>
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
  const { tasks, updateTaskStatus, addTask, updateTask, deleteTask } = useAppStore();
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const filteredTasks = tasks.filter((task) => {
    const matchesFilter = filter === 'all' || task.status === filter;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  const statusConfig = {
    todo: { label: 'A Fazer', icon: Circle, color: 'text-muted-foreground' },
    in_progress: { label: 'Em Andamento', icon: AlertCircle, color: 'text-warning' },
    done: { label: 'Concluídas', icon: CheckCircle2, color: 'text-success' },
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete.id);
      toast({
        title: 'Tarefa excluída',
        description: 'A tarefa foi removida com sucesso.',
      });
    }
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
  };

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt'> & { id?: string }) => {
    if (taskData.id) {
      updateTask(taskData.id, taskData);
      toast({
        title: 'Tarefa atualizada',
        description: 'As alterações foram salvas.',
      });
    } else {
      addTask(taskData);
      toast({
        title: 'Tarefa criada',
        description: 'Nova tarefa adicionada com sucesso.',
      });
    }
  };

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    updateTaskStatus(taskId, status);
    if (status === 'done') {
      toast({
        title: 'Tarefa concluída!',
        description: 'Parabéns por completar a tarefa.',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">
            {tasks.length} tarefas · {tasksByStatus.todo.length} pendentes
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
      {view === 'calendar' ? (
        <TaskCalendar tasks={tasks} onTaskClick={handleEditTask} />
      ) : view === 'list' ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={(status) => handleStatusChange(task.id, status)}
              onEdit={() => handleEditTask(task)}
              onDelete={() => handleDeleteClick(task)}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(tasksByStatus) as Array<keyof typeof tasksByStatus>).map((status) => {
            const config = statusConfig[status];
            const statusTasks = tasksByStatus[status];

            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-4">
                  <config.icon className={cn('w-5 h-5', config.color)} />
                  <h3 className="font-semibold text-foreground">{config.label}</h3>
                  <Badge variant="secondary">{statusTasks.length}</Badge>
                </div>

                <div className="space-y-3">
                  {statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                      onEdit={() => handleEditTask(task)}
                      onDelete={() => handleDeleteClick(task)}
                    />
                  ))}

                  {statusTasks.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                      <p className="text-sm">Nenhuma tarefa</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={selectedTask}
        onSave={handleSaveTask}
        onDelete={(id) => {
          deleteTask(id);
          toast({
            title: 'Tarefa excluída',
            description: 'A tarefa foi removida com sucesso.',
          });
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
