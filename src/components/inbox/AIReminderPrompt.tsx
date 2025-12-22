import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Calendar, X, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AIReminderPromptProps {
  reminder: {
    hasReminder: boolean;
    taskTitle?: string;
    taskDescription?: string;
    suggestedDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
  leadId?: string;
  onCreateTask: (task: {
    title: string;
    description: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    leadId?: string;
  }) => void;
  onDismiss: () => void;
}

const priorityLabels = {
  low: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Média', color: 'bg-blue-500/10 text-blue-600' },
  high: { label: 'Alta', color: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
};

export function AIReminderPrompt({
  reminder,
  leadId,
  onCreateTask,
  onDismiss,
}: AIReminderPromptProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState(reminder.taskTitle || '');
  const [description, setDescription] = useState(reminder.taskDescription || '');
  const [dueDate, setDueDate] = useState(
    reminder.suggestedDate || format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    reminder.priority || 'medium'
  );

  if (!reminder.hasReminder) {
    return null;
  }

  const handleQuickCreate = () => {
    onCreateTask({
      title: title || 'Lembrete',
      description,
      dueDate,
      priority,
      leadId,
    });
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
        className="fixed bottom-24 right-8 z-50 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Lembrete Detectado</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDismiss}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          <p className="text-sm text-foreground">
            {reminder.taskDescription || 'Promessa de retorno detectada'}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Sugerido para: {formattedDate}</span>
          </div>

          {/* Expanded form */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 pt-2 border-t border-border"
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
                      'text-xs cursor-pointer',
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
              <ChevronDown className={cn(
                "w-3 h-3 mr-1 transition-transform",
                isExpanded && "rotate-180"
              )} />
              {isExpanded ? 'Menos' : 'Editar'}
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gradient-primary text-primary-foreground"
              onClick={handleQuickCreate}
            >
              <Check className="w-3 h-3 mr-1" />
              Criar Tarefa
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
