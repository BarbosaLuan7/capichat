import React from 'react';
import { Loader2 } from 'lucide-react';

interface UploadIndicatorProps {
  progress: number;
}

export function UploadIndicator({ progress }: UploadIndicatorProps) {
  return (
    <div className="border-t border-border bg-muted/50 px-4 py-2">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          Enviando... {progress}%
        </span>
      </div>
    </div>
  );
}
