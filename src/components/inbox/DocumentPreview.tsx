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
      <div className={cn(
        "rounded-lg overflow-hidden border max-w-[280px]",
        isAgent ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-background/50"
      )}>
        {/* Mini PDF Preview */}
        <div className="relative w-full h-[100px] bg-muted/30 overflow-hidden">
          <iframe
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="w-full h-[200px] scale-50 origin-top-left pointer-events-none"
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
        <div className={cn(
          "flex items-center gap-2 p-2",
          isAgent ? "bg-primary-foreground/5" : "bg-muted/30"
        )}>
          <FileText className={cn(
            "w-4 h-4 flex-shrink-0",
            isPdf ? "text-red-500" : "text-muted-foreground"
          )} />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-sm flex-1 truncate underline hover:no-underline",
              isAgent ? "text-primary-foreground" : "text-foreground"
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
            <Download className={cn(
              "w-3.5 h-3.5",
              isAgent ? "text-primary-foreground/70" : "text-muted-foreground"
            )} />
          </Button>
        </div>
      </div>
    );
  }

  // Fallback for non-PDF or if preview failed
  return (
    <div className={cn(
      "flex items-center gap-2 p-2.5 rounded-lg max-w-[280px]",
      isAgent 
        ? "bg-primary-foreground/10 border border-primary-foreground/20" 
        : "bg-background/50 border border-border"
    )}>
      <FileText className={cn(
        "w-5 h-5 flex-shrink-0",
        isPdf ? "text-red-500" : isAgent ? "text-primary-foreground/70" : "text-muted-foreground"
      )} />
      
      <div className="flex-1 min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-sm font-medium truncate block underline hover:no-underline",
            isAgent ? "text-primary-foreground" : "text-foreground"
          )}
          title={fileName}
        >
          {fileName}
        </a>
        {previewError && (
          <span className={cn(
            "text-xs flex items-center gap-1",
            isAgent ? "text-primary-foreground/60" : "text-muted-foreground"
          )}>
            <AlertCircle className="w-3 h-3" />
            Preview indisponível
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDownload}
          title="Baixar"
        >
          <Download className={cn(
            "w-4 h-4",
            isAgent ? "text-primary-foreground/70" : "text-muted-foreground"
          )} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.open(url, '_blank')}
          title="Abrir em nova aba"
        >
          <ExternalLink className={cn(
            "w-4 h-4",
            isAgent ? "text-primary-foreground/70" : "text-muted-foreground"
          )} />
        </Button>
      </div>
    </div>
  );
}

export const DocumentPreview = memo(DocumentPreviewComponent, (prev, next) =>
  prev.url === next.url && prev.fileName === next.fileName && prev.isAgent === next.isAgent
);
