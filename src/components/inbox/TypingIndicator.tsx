import React from 'react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  className?: string;
  name?: string;
}

export function TypingIndicator({ className, name }: TypingIndicatorProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5 max-w-3xl mx-auto w-full">
        {/* Animated dots */}
        <div className="flex items-center gap-0.5" aria-hidden="true">
          <span 
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '600ms' }}
          />
          <span 
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '600ms' }}
          />
          <span 
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '600ms' }}
          />
        </div>
        
        {/* Text */}
        <span className="text-sm text-muted-foreground">
          {name ? `${name} está digitando...` : 'digitando...'}
        </span>
      </div>
    </div>
  );
}
