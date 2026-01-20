import { useState, useEffect, useRef, useCallback, memo } from 'react';
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
  Save,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useAISummary } from '@/hooks/useAISummary';
import { useUpdateLead } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface AIConversationSummaryProps {
  messages: any[];
  lead: {
    id: string;
    name: string;
    phone?: string;
    source?: string;
    funnel_stages?: { name: string } | null;
    ai_summary?: string | null; // Campo do resumo salvo no banco
  };
  onSummaryGenerated?: () => void;
  className?: string;
}

function AIConversationSummaryComponent({
  messages,
  lead,
  onSummaryGenerated,
  className,
}: AIConversationSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [autoSaved, setAutoSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showingSavedSummary, setShowingSavedSummary] = useState(false);
  const previousLeadIdRef = useRef<string>(lead.id);

  const { summaryResult, isLoading, fetchSummary, clearSummary } = useAISummary();
  const updateLead = useUpdateLead();

  const handleRefresh = () => {
    setAutoSaved(false);
    setShowingSavedSummary(false);
    clearSummary();
    if (messages && messages.length > 0) {
      fetchSummary(messages, {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        stage: lead.funnel_stages?.name,
      });
    }
  };

  const handleSave = useCallback(
    async (summary: string, isAuto = false) => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        await updateLead.mutateAsync({
          id: lead.id,
          ai_summary: summary,
        });
        if (isAuto) {
          setAutoSaved(true);
        } else {
          toast.success('Resumo salvo no lead');
        }
        onSummaryGenerated?.();
      } catch (error) {
        if (!isAuto) {
          toast.error('Erro ao salvar resumo');
        }
      } finally {
        setIsSaving(false);
      }
    },
    [lead.id, updateLead, onSummaryGenerated, isSaving]
  );

  // Reset autoSaved when lead changes
  useEffect(() => {
    if (previousLeadIdRef.current !== lead.id) {
      setAutoSaved(false);
      previousLeadIdRef.current = lead.id;
    }
  }, [lead.id]);

  // Carregar resumo salvo do lead ao montar ou trocar de lead
  useEffect(() => {
    // Se já tem resumo gerado no state, não sobrescrever
    if (summaryResult) {
      setShowingSavedSummary(false);
      return;
    }

    // Se o lead tem resumo salvo no banco, mostrar ele
    setShowingSavedSummary(!!lead.ai_summary);
  }, [lead.id, lead.ai_summary, summaryResult]);

  // Auto-save summary 3 seconds after generation
  useEffect(() => {
    if (summaryResult?.summary && !autoSaved && !isSaving) {
      const timer = setTimeout(() => {
        handleSave(summaryResult.summary, true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [summaryResult?.summary, autoSaved, isSaving, handleSave]);

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border border-primary/20 bg-primary/5 p-3', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          <span>Gerando resumo...</span>
        </div>
      </div>
    );
  }

  // Se não tem resumo gerado no state, verificar se tem resumo salvo no banco
  if (!summaryResult) {
    // Se tem resumo salvo no lead, mostrar ele com badge "Salvo"
    if (lead.ai_summary && showingSavedSummary) {
      return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
          <div className="overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            {/* Header */}
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 transition-colors hover:bg-primary/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Resumo IA</span>
                  <Badge variant="secondary" className="text-xs">
                    Salvo
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefresh();
                    }}
                    title="Gerar novo resumo"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <ScrollArea className="max-h-80">
                <div className="p-3 pt-0">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{lead.ai_summary}</p>
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </div>
        </Collapsible>
      );
    }

    // Se não tem nenhum resumo (nem gerado, nem salvo), mostrar botão para gerar
    return (
      <div className={cn('rounded-lg border border-border bg-muted/50 p-3', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>Resumo IA</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleRefresh}
            disabled={!messages || messages.length === 0}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Gerar
          </Button>
        </div>
        {(!messages || messages.length === 0) && (
          <p className="mt-2 text-xs text-muted-foreground">Sem mensagens para analisar</p>
        )}
      </div>
    );
  }

  const { summary, structured } = summaryResult;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
      <div className="overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        {/* Header */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 transition-colors hover:bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Resumo IA</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh();
                }}
                title="Atualizar resumo"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              {autoSaved ? (
                <div
                  className="flex items-center gap-1 px-2 text-xs text-success"
                  title="Salvo automaticamente"
                >
                  <Check className="h-3 w-3" />
                  <span>Salvo</span>
                </div>
              ) : isSaving ? (
                <div
                  className="flex items-center gap-1 px-2 text-xs text-muted-foreground"
                  title="Salvando..."
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Salvando</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave(summary);
                  }}
                  title="Salvar no lead"
                >
                  <Save className="h-3 w-3" />
                </Button>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="max-h-80">
            <div className="space-y-3 p-3 pt-0">
              {/* Quick summary */}
              <p className="text-sm text-foreground">{summary}</p>

              {structured && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3 border-t border-primary/20 pt-2"
                >
                  {/* Situation */}
                  {structured.situation && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        SITUAÇÃO
                      </div>
                      <p className="text-sm">{structured.situation}</p>
                    </div>
                  )}

                  {/* Benefit */}
                  {structured.benefit && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-xs">
                        {structured.benefit}
                      </Badge>
                    </div>
                  )}

                  {/* Health conditions */}
                  {structured.healthConditions && structured.healthConditions.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Heart className="h-3 w-3" />
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
                  {((structured.documentsReceived && structured.documentsReceived.length > 0) ||
                    (structured.documentsPending && structured.documentsPending.length > 0)) && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        DOCUMENTOS
                      </div>
                      {structured.documentsReceived && structured.documentsReceived.length > 0 && (
                        <div className="text-xs">
                          <span className="text-success">✓ Recebidos: </span>
                          <span>{structured.documentsReceived.join(', ')}</span>
                        </div>
                      )}
                      {structured.documentsPending && structured.documentsPending.length > 0 && (
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
                        <Calendar className="h-3 w-3" />
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
                        <AlertCircle className="h-3 w-3" />
                        PRÓXIMOS PASSOS
                      </div>
                      <ul className="list-inside list-disc space-y-0.5 text-xs">
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
                        <Lightbulb className="h-3 w-3" />
                        OBSERVAÇÕES
                      </div>
                      <p className="text-xs italic text-muted-foreground">
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

export const AIConversationSummary = memo(
  AIConversationSummaryComponent,
  (prev, next) =>
    prev.lead.id === next.lead.id &&
    prev.messages?.length === next.messages?.length &&
    prev.className === next.className
);
