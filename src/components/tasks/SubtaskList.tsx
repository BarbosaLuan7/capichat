import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface SubtaskListProps {
  subtasks: Subtask[];
  onToggle?: (subtaskId: string, completed: boolean) => void;
  compact?: boolean;
}

export function SubtaskList({ subtasks, onToggle, compact = false }: SubtaskListProps) {
  if (!subtasks || subtasks.length === 0) return null;

  const completedCount = subtasks.filter((s) => s.completed).length;
  const totalCount = subtasks.length;
  const progress = (completedCount / totalCount) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Check className="h-3 w-3" />
          <span>
            {completedCount}/{totalCount}
          </span>
        </div>
        <Progress value={progress} className="h-1.5 w-16" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {completedCount}/{totalCount} concluídas
        </span>
        <Progress value={progress} className="h-1.5 flex-1" />
      </div>
      <div className="space-y-1.5">
        {subtasks.map((subtask) => (
          <label
            key={subtask.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm hover:bg-muted/50',
              subtask.completed && 'text-muted-foreground line-through'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={(checked) => onToggle?.(subtask.id, !!checked)}
              className="h-4 w-4"
            />
            <span className="truncate">{subtask.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
