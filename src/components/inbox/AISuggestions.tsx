import { motion } from 'framer-motion';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AISuggestionsProps {
  suggestions: { text: string; intent: string }[];
  isLoading: boolean;
  onSelectSuggestion: (text: string) => void;
  onRefresh: () => void;
}

const intentColors: Record<string, string> = {
  greeting: 'bg-primary/10 text-primary hover:bg-primary/20',
  info: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20',
  action: 'bg-success/10 text-success hover:bg-success/20',
  closing: 'bg-muted text-muted-foreground hover:bg-muted/80',
};

export function AISuggestions({
  suggestions,
  isLoading,
  onSelectSuggestion,
  onRefresh,
}: AISuggestionsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4 animate-pulse text-primary" />
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
      className="px-4 py-2 border-t border-border bg-gradient-to-r from-primary/5 to-transparent"
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>IA:</span>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelectSuggestion(suggestion.text)}
              aria-label={`Usar sugestão: ${suggestion.text.substring(0, 50)}`}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                intentColors[suggestion.intent] || intentColors.info
              )}
            >
              {suggestion.text.length > 50 
                ? suggestion.text.substring(0, 50) + '...' 
                : suggestion.text}
            </motion.button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onRefresh}
          aria-label="Gerar novas sugestões"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
