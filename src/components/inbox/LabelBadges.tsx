import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, getContrastTextColor } from '@/lib/utils';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LabelBadgesProps {
  labels: Label[];
  maxVisible?: number;
  size?: 'sm' | 'md';
}

function LabelBadgesComponent({ labels, maxVisible = 2, size = 'sm' }: LabelBadgesProps) {
  if (!labels || labels.length === 0) return null;

  const visibleLabels = labels.slice(0, maxVisible);
  const hiddenLabels = labels.slice(maxVisible);
  const hasHidden = hiddenLabels.length > 0;

  const badgeClasses = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0 h-5 border-0' 
    : 'text-xs px-2 py-0.5 border-0';

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleLabels.map((label) => (
        <Badge
          key={label.id}
          className={cn(badgeClasses, 'max-w-[80px] truncate', getContrastTextColor(label.color))}
          style={{
            backgroundColor: label.color,
          }}
          title={label.name}
        >
          {label.name}
        </Badge>
      ))}
      
      {hasHidden && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className={badgeClasses}>
                +{hiddenLabels.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div className="flex flex-wrap gap-1">
                {hiddenLabels.map((label) => (
                  <Badge
                    key={label.id}
                    className={cn(
                      "text-[10px] px-1.5 py-0 border-0",
                      getContrastTextColor(label.color)
                    )}
                    style={{
                      backgroundColor: label.color,
                    }}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export const LabelBadges = memo(LabelBadgesComponent, (prev, next) =>
  prev.maxVisible === next.maxVisible &&
  prev.size === next.size &&
  prev.labels?.length === next.labels?.length &&
  (prev.labels || []).every((l, i) => l.id === next.labels?.[i]?.id)
);
