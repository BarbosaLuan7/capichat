import { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AISuggestionsProps {
  suggestions: { text: string; intent: string }[];
  isLoading: boolean;
  onSelectSuggestion: (text: string) => void;
  onRefresh: () => void;
}

const intentColors: Record<string, string> = {
  greeting: 'bg-primary/10 text-primary hover:bg-primary/20',
  info: 'bg-info/10 text-info hover:bg-info/20',
  action: 'bg-success/10 text-success hover:bg-success/20',
  closing: 'bg-muted text-muted-foreground hover:bg-muted/80',
};

// ForwardRef wrapper for motion.button to work with TooltipTrigger
const SuggestionButton = forwardRef<
  HTMLButtonElement,
  {
    suggestion: { text: string; intent: string };
    index: number;
    onClick: () => void;
  }
>(({ suggestion, index, onClick, ...props }, ref) => {
  const isTruncated = suggestion.text.length > 50;
  const displayText = isTruncated ? suggestion.text.substring(0, 50) + '...' : suggestion.text;

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      aria-label={`Usar sugestão: ${suggestion.text.substring(0, 50)}`}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        intentColors[suggestion.intent] || intentColors.info
      )}
      {...props}
    >
      {displayText}
    </motion.button>
  );
});

SuggestionButton.displayName = 'SuggestionButton';

function AISuggestionsComponent({
  suggestions,
  isLoading,
  onSelectSuggestion,
  onRefresh,
}: AISuggestionsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        <span>Gerando sugestões...</span>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-t border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-2"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>IA:</span>
        </div>

        <div className="scrollbar-hide flex flex-1 items-center gap-2 overflow-x-auto">
          {suggestions.map((suggestion, index) => {
            const isTruncated = suggestion.text.length > 50;

            if (isTruncated) {
              return (
                <TooltipProvider key={index} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SuggestionButton
                        suggestion={suggestion}
                        index={index}
                        onClick={() => onSelectSuggestion(suggestion.text)}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-sm">{suggestion.text}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <SuggestionButton
                key={index}
                suggestion={suggestion}
                index={index}
                onClick={() => onSelectSuggestion(suggestion.text)}
              />
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onRefresh}
          aria-label="Gerar novas sugestões"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export const AISuggestions = memo(AISuggestionsComponent, (prev, next) => {
  if (prev.isLoading !== next.isLoading) return false;
  if (prev.suggestions?.length !== next.suggestions?.length) return false;
  // Deep compare suggestions only if lengths match
  if (prev.suggestions && next.suggestions) {
    for (let i = 0; i < prev.suggestions.length; i++) {
      if (prev.suggestions[i].text !== next.suggestions[i].text) return false;
    }
  }
  return true;
});
