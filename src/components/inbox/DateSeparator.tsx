import { memo } from 'react';
import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateSeparatorProps {
  date: Date;
}

function DateSeparatorComponent({ date }: DateSeparatorProps) {
  const formatDateLabel = (d: Date): string => {
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    if (isThisYear(d)) return format(d, "d 'de' MMMM", { locale: ptBR });
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="px-2 text-xs font-medium capitalize text-muted-foreground">
        {formatDateLabel(date)}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

DateSeparatorComponent.displayName = 'DateSeparator';

export const DateSeparator = memo(
  DateSeparatorComponent,
  (prev, next) => prev.date.getTime() === next.date.getTime()
);
