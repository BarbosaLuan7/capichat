import { useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

function ExpandableTextComponent({ text, maxLength = 150, className }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || text.length <= maxLength) {
    return <span className={className}>{text}</span>;
  }

  return (
    <div className={cn('relative', className)}>
      <span>{isExpanded ? text : `${text.substring(0, maxLength)}...`}</span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
      >
        {isExpanded ? (
          <>
            Ver menos <ChevronUp className="h-3 w-3" />
          </>
        ) : (
          <>
            Ver mais <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>
    </div>
  );
}

export const ExpandableText = memo(
  ExpandableTextComponent,
  (prev, next) => prev.text === next.text && prev.maxLength === next.maxLength
);
