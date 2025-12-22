import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Heart,
  Calendar,
  AlertCircle,
  Lightbulb,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface StructuredSummary {
  situation?: string;
  benefit?: string;
  healthConditions?: string[];
  documentsReceived?: string[];
  documentsPending?: string[];
  importantDates?: { date: string; description: string }[];
  nextSteps?: string[];
  observations?: string;
  summaryText: string;
}

interface AIConversationSummaryProps {
  summaryResult: {
    summary: string;
    structured: StructuredSummary | null;
  } | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSave: (summary: string) => void;
  className?: string;
}

export function AIConversationSummary({
  summaryResult,
  isLoading,
  onRefresh,
  onSave,
  className,
}: AIConversationSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className={cn("p-3 rounded-lg bg-primary/5 border border-primary/20", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 animate-pulse text-primary" />
          <span>Gerando resumo...</span>
        </div>
      </div>
    );
  }

  if (!summaryResult) {
    return (
      <div className={cn("p-3 rounded-lg bg-muted/50 border border-border", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <span>Resumo IA</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onRefresh}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Gerar
          </Button>
        </div>
      </div>
    );
  }

  const { summary, structured } = summaryResult;

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className={className}
    >
      <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 overflow-hidden">
        {/* Header */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Resumo IA</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                title="Atualizar resumo"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(summary);
                }}
                title="Salvar no lead"
              >
                <Save className="w-3 h-3" />
              </Button>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="max-h-80">
            <div className="p-3 pt-0 space-y-3">
              {/* Quick summary */}
              <p className="text-sm text-foreground">{summary}</p>

              {structured && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3 pt-2 border-t border-primary/20"
                >
                  {/* Situation */}
                  {structured.situation && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        SITUAÇÃO
                      </div>
                      <p className="text-sm">{structured.situation}</p>
                    </div>
                  )}

                  {/* Benefit */}
                  {structured.benefit && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-primary/10 border-primary/20">
                        {structured.benefit}
                      </Badge>
                    </div>
                  )}

                  {/* Health conditions */}
                  {structured.healthConditions && structured.healthConditions.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Heart className="w-3 h-3" />
                        CONDIÇÕES
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {structured.healthConditions.map((condition, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {(structured.documentsReceived?.length > 0 || structured.documentsPending?.length > 0) && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        DOCUMENTOS
                      </div>
                      {structured.documentsReceived?.length > 0 && (
                        <div className="text-xs">
                          <span className="text-success">✓ Recebidos: </span>
                          <span>{structured.documentsReceived.join(', ')}</span>
                        </div>
                      )}
                      {structured.documentsPending?.length > 0 && (
                        <div className="text-xs">
                          <span className="text-warning">⏳ Pendentes: </span>
                          <span>{structured.documentsPending.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Important dates */}
                  {structured.importantDates && structured.importantDates.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        DATAS
                      </div>
                      <div className="space-y-0.5">
                        {structured.importantDates.map((item, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium">{item.date}:</span> {item.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next steps */}
                  {structured.nextSteps && structured.nextSteps.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <AlertCircle className="w-3 h-3" />
                        PRÓXIMOS PASSOS
                      </div>
                      <ul className="text-xs space-y-0.5 list-disc list-inside">
                        {structured.nextSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Observations */}
                  {structured.observations && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Lightbulb className="w-3 h-3" />
                        OBSERVAÇÕES
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        {structured.observations}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
