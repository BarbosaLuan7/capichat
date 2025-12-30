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
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium px-2 capitalize">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

DateSeparatorComponent.displayName = 'DateSeparator';

export const DateSeparator = memo(DateSeparatorComponent, (prev, next) => 
  prev.date.getTime() === next.date.getTime()
);
