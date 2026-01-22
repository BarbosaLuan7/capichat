import React from 'react';
import { Button } from '@/components/ui/button';
import type { PendingFile } from '@/hooks/useSendMessage';

interface FilePreviewBannerProps {
  pendingFile: PendingFile;
  onCancel: () => void;
}

export function FilePreviewBanner({ pendingFile, onCancel }: FilePreviewBannerProps) {
  return (
    <div className="border-t border-border bg-muted/50 px-4 py-2">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {/* Miniatura da imagem se for imagem */}
        {pendingFile.type === 'image' && (
          <img
            src={URL.createObjectURL(pendingFile.file)}
            alt="Preview"
            className="h-12 w-12 rounded-lg border border-border object-cover"
          />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {pendingFile.file.name}
          </span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            ({(pendingFile.file.size / 1024).toFixed(1)} KB)
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
