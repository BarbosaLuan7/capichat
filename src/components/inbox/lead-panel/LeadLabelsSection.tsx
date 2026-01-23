import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn, getContrastTextColor } from '@/lib/utils';
import type { Label } from './types';

interface LeadLabelsSectionProps {
  labels?: Label[];
}

function LeadLabelsSectionComponent({ labels }: LeadLabelsSectionProps) {
  if (!labels || labels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-4">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">Etiquetas</h4>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <Badge
            key={label.id}
            className={cn('border-0 text-xs', getContrastTextColor(label.color))}
            style={{ backgroundColor: label.color }}
          >
            {label.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const LeadLabelsSection = memo(LeadLabelsSectionComponent);
