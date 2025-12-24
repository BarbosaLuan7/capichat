import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export function ExpandableText({ text, maxLength = 150, className }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text || text.length <= maxLength) {
    return <span className={className}>{text}</span>;
  }

  return (
    <div className={cn("relative", className)}>
      <span>
        {isExpanded ? text : `${text.substring(0, maxLength)}...`}
      </span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-0.5 ml-1 text-primary text-xs font-medium hover:underline"
      >
        {isExpanded ? (
          <>
            Ver menos <ChevronUp className="w-3 h-3" />
          </>
        ) : (
          <>
            Ver mais <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>
    </div>
  );
}
