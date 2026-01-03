import React from 'react';
import { CornerUpLeft, Square, CheckSquare, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MessageActionsProps {
  show: boolean;
  isAgent: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  content?: string;
  onReply: () => void;
  onToggleSelect: () => void;
}

export function MessageActions({
  show,
  isAgent,
  isSelected,
  selectionMode,
  content,
  onReply,
  onToggleSelect,
}: MessageActionsProps) {
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!content) return;
    
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copiado!', { duration: 1500 });
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity duration-200",
        isAgent ? "-left-20" : "-right-20",
        show || selectionMode ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border/50",
                isSelected && "bg-primary/10 border-primary/30"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
            >
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={isAgent ? "left" : "right"} className="text-xs">
            {isSelected ? "Desmarcar" : "Selecionar"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {!selectionMode && content && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border/50"
                onClick={handleCopy}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isAgent ? "left" : "right"} className="text-xs">
              Copiar
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {!selectionMode && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border/50"
                onClick={(e) => {
                  e.stopPropagation();
                  onReply();
                }}
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isAgent ? "left" : "right"} className="text-xs">
              Responder
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
