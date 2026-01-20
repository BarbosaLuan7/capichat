import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Calendar, X, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCreateTask } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AIReminder {
  hasReminder: boolean;
  taskTitle?: string;
  taskDescription?: string;
  suggestedDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

interface AIReminderPromptProps {
  show: boolean;
  reminder: AIReminder | null;
  isLoading: boolean;
  leadId?: string;
  onClose: () => void;
}

const priorityLabels = {
  low: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Média', color: 'bg-info/10 text-info' },
  high: { label: 'Alta', color: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
};

export function AIReminderPrompt({
  show,
  reminder,
  isLoading,
  leadId,
  onClose,
}: AIReminderPromptProps) {
  const { user } = useAuth();
  const createTask = useCreateTask();

  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  // Update form when reminder changes
  useEffect(() => {
    if (reminder) {
      setTitle(reminder.taskTitle || '');
      setDescription(reminder.taskDescription || '');
      setDueDate(reminder.suggestedDate || format(addDays(new Date(), 1), 'yyyy-MM-dd'));
      setPriority(reminder.priority || 'medium');
    }
  }, [reminder]);

  if (!show || isLoading || !reminder?.hasReminder) {
    return null;
  }

  const handleQuickCreate = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      await createTask.mutateAsync({
        title: title || 'Lembrete',
        description,
        due_date: dueDate,
        priority,
        lead_id: leadId,
        assigned_to: user.id,
        status: 'todo',
      });
      toast.success('Tarefa criada com sucesso');
      onClose();
    } catch (error) {
      toast.error('Erro ao criar tarefa');
    }
  };

  const formattedDate = dueDate
    ? format(parseISO(dueDate), "dd 'de' MMMM", { locale: ptBR })
    : 'Amanhã';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-24 right-8 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 to-primary/5 p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Lembrete Detectado</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Fechar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-3 p-3">
          <p className="text-sm text-foreground">
            {reminder.taskDescription || 'Promessa de retorno detectada'}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Sugerido para: {formattedDate}</span>
          </div>

          {/* Expanded form */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 border-t border-border pt-2"
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da tarefa"
                className="text-sm"
              />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-1">
                {(Object.keys(priorityLabels) as Array<keyof typeof priorityLabels>).map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className={cn(
                      'cursor-pointer text-xs',
                      priority === p && priorityLabels[p].color
                    )}
                    onClick={() => setPriority(p)}
                  >
                    {priorityLabels[p].label}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <ChevronDown
                className={cn('mr-1 h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
              />
              {isExpanded ? 'Menos' : 'Editar'}
            </Button>
            <Button
              size="sm"
              className="gradient-primary flex-1 text-xs text-primary-foreground"
              onClick={handleQuickCreate}
              disabled={createTask.isPending}
            >
              <Check className="mr-1 h-3 w-3" />
              Criar Tarefa
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
