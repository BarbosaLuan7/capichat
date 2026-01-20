import { useState, memo } from 'react';
import { FileText, Download, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentPreviewProps {
  url: string;
  fileName: string;
  isAgent?: boolean;
}

function DocumentPreviewComponent({ url, fileName, isAgent = false }: DocumentPreviewProps) {
  const [previewError, setPreviewError] = useState(false);
  const isPdf = fileName.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  if (isPdf && !previewError) {
    return (
      <div
        className={cn(
          'max-w-[280px] overflow-hidden rounded-lg border',
          isAgent
            ? 'border-primary-foreground/20 bg-primary-foreground/10'
            : 'border-border bg-background/50'
        )}
      >
        {/* Mini PDF Preview */}
        <div className="relative h-[100px] w-full overflow-hidden bg-muted/30">
          <iframe
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="pointer-events-none h-[200px] w-full origin-top-left scale-50"
            style={{ width: '200%' }}
            title={fileName}
            onError={() => setPreviewError(true)}
          />
          {/* Overlay to prevent interaction */}
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => window.open(url, '_blank')}
          />
        </div>

        {/* File info and actions */}
        <div
          className={cn(
            'flex items-center gap-2 p-2',
            isAgent ? 'bg-primary-foreground/5' : 'bg-muted/30'
          )}
        >
          <FileText
            className={cn(
              'h-4 w-4 flex-shrink-0',
              isPdf ? 'text-destructive' : 'text-muted-foreground'
            )}
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex-1 truncate text-sm underline hover:no-underline',
              isAgent ? 'text-primary-foreground' : 'text-foreground'
            )}
            title={fileName}
          >
            {fileName}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDownload}
            title="Baixar"
          >
            <Download
              className={cn(
                'h-3.5 w-3.5',
                isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            />
          </Button>
        </div>
      </div>
    );
  }

  // Fallback for non-PDF or if preview failed
  return (
    <div
      className={cn(
        'flex max-w-[280px] items-center gap-2 rounded-lg p-2.5',
        isAgent
          ? 'border border-primary-foreground/20 bg-primary-foreground/10'
          : 'border border-border bg-background/50'
      )}
    >
      <FileText
        className={cn(
          'h-5 w-5 flex-shrink-0',
          isPdf
            ? 'text-destructive'
            : isAgent
              ? 'text-primary-foreground/70'
              : 'text-muted-foreground'
        )}
      />

      <div className="min-w-0 flex-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'block truncate text-sm font-medium underline hover:no-underline',
            isAgent ? 'text-primary-foreground' : 'text-foreground'
          )}
          title={fileName}
        >
          {fileName}
        </a>
        {previewError && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              isAgent ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}
          >
            <AlertCircle className="h-3 w-3" />
            Preview indisponível
          </span>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDownload}
          title="Baixar"
        >
          <Download
            className={cn(
              'h-4 w-4',
              isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.open(url, '_blank')}
          title="Abrir em nova aba"
        >
          <ExternalLink
            className={cn(
              'h-4 w-4',
              isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>
    </div>
  );
}

export const DocumentPreview = memo(
  DocumentPreviewComponent,
  (prev, next) =>
    prev.url === next.url && prev.fileName === next.fileName && prev.isAgent === next.isAgent
);
