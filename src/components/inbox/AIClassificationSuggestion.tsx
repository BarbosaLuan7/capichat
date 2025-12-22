import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ThermometerSun, Tag, Check, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAIClassification } from '@/hooks/useAIClassification';
import { useLabels, useAddLeadLabel } from '@/hooks/useLabels';
import { useUpdateLead } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface AIClassificationSuggestionProps {
  messages: any[];
  lead: {
    id: string;
    name: string;
    temperature?: string;
    labels?: { id: string; name: string }[];
  };
  onApplyClassification?: () => void;
}

const temperatureLabels = {
  cold: { label: '❄️ Frio', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  warm: { label: '🌡️ Morno', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  hot: { label: '🔥 Quente', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
};

const confidenceLabels = {
  low: { label: 'Baixa', color: 'text-muted-foreground' },
  medium: { label: 'Média', color: 'text-warning' },
  high: { label: 'Alta', color: 'text-success' },
};

export function AIClassificationSuggestion({
  messages,
  lead,
  onApplyClassification,
}: AIClassificationSuggestionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const { classification, isLoading, fetchClassification, clearClassification } = useAIClassification();
  const { data: availableLabels } = useLabels();
  const addLeadLabel = useAddLeadLabel();
  const updateLead = useUpdateLead();

  const handleRefresh = () => {
    if (messages && messages.length > 0 && availableLabels) {
      setIsDismissed(false);
      fetchClassification(
        messages,
        {
          name: lead.name,
          temperature: lead.temperature,
          labels: lead.labels,
        },
        availableLabels
      );
    }
  };

  const handleApplyTemperature = async (temp: 'cold' | 'warm' | 'hot') => {
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        temperature: temp,
      });
      toast.success('Temperatura atualizada');
      onApplyClassification?.();
    } catch (error) {
      toast.error('Erro ao atualizar temperatura');
    }
  };

  const handleApplyLabel = async (labelId: string) => {
    try {
      await addLeadLabel.mutateAsync({
        leadId: lead.id,
        labelId: labelId,
      });
      toast.success('Etiqueta adicionada');
      onApplyClassification?.();
    } catch (error) {
      toast.error('Erro ao adicionar etiqueta');
    }
  };

  const handleApplyAll = async () => {
    if (!classification) return;
    
    try {
      // Apply temperature
      if (classification.suggestedTemperature !== lead.temperature) {
        await updateLead.mutateAsync({
          id: lead.id,
          temperature: classification.suggestedTemperature,
        });
      }
      
      // Apply labels
      const currentLabelNames = lead.labels?.map(l => l.name) || [];
      const newLabels = classification.suggestedLabels.filter(
        name => !currentLabelNames.includes(name)
      );
      
      for (const labelName of newLabels) {
        const label = availableLabels?.find(l => l.name === labelName);
        if (label) {
          await addLeadLabel.mutateAsync({
            leadId: lead.id,
            labelId: label.id,
          });
        }
      }
      
      toast.success('Todas as sugestões aplicadas');
      onApplyClassification?.();
      clearClassification();
    } catch (error) {
      toast.error('Erro ao aplicar sugestões');
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    clearClassification();
  };

  if (isDismissed || (!isLoading && !classification)) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="w-4 h-4" />
            <span>Classificação IA</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleRefresh}
            disabled={!messages || messages.length === 0}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Analisar
          </Button>
        </div>
        {(!messages || messages.length === 0) && (
          <p className="text-xs text-muted-foreground mt-2">
            Sem mensagens para analisar
          </p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 animate-pulse text-primary" />
          <span>Analisando conversa...</span>
        </div>
      </div>
    );
  }

  if (!classification) {
    return null;
  }

  const currentLabelNames = lead.labels?.map(l => l.name) || [];
  const temperatureChanged = classification.suggestedTemperature !== lead.temperature;
  const newLabels = classification.suggestedLabels.filter(
    name => !currentLabelNames.includes(name)
  );
  const hasChanges = temperatureChanged || newLabels.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">Classificação IA</span>
          <Badge variant="outline" className={cn('text-xs px-1.5', confidenceLabels[classification.confidence].color)}>
            Confiança: {confidenceLabels[classification.confidence].label}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            title="Reanalisar"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={handleDismiss}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {/* Benefit suggestion */}
          {classification.suggestedBenefit && (
            <div className="text-sm">
              <span className="text-muted-foreground">Benefício provável: </span>
              <span className="font-medium">{classification.suggestedBenefit}</span>
            </div>
          )}

          {/* Temperature suggestion */}
          {temperatureChanged && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ThermometerSun className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">Temperatura:</span>
                <Badge 
                  variant="outline" 
                  className={cn('text-xs', temperatureLabels[classification.suggestedTemperature].color)}
                >
                  {temperatureLabels[classification.suggestedTemperature].label}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary"
                onClick={() => handleApplyTemperature(classification.suggestedTemperature)}
              >
                <Check className="w-3 h-3 mr-1" />
                Aplicar
              </Button>
            </div>
          )}

          {/* Labels suggestion */}
          {newLabels.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">Etiquetas sugeridas:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {newLabels.map((labelName) => {
                  const label = availableLabels?.find((l) => l.name === labelName);
                  if (!label) return null;
                  return (
                    <Badge
                      key={label.id}
                      className="text-xs cursor-pointer hover:opacity-80 border-0 gap-1"
                      style={{ backgroundColor: label.color, color: 'white' }}
                      onClick={() => handleApplyLabel(label.id)}
                    >
                      {label.name}
                      <Check className="w-2.5 h-2.5" />
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Health conditions */}
          {classification.healthConditions && classification.healthConditions.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span>Condições detectadas: </span>
              <span className="text-foreground">{classification.healthConditions.join(', ')}</span>
            </div>
          )}

          {/* Reasoning */}
          <p className="text-xs text-muted-foreground italic">
            {classification.reasoning}
          </p>

          {/* Apply all button */}
          {hasChanges && (
            <Button
              size="sm"
              className="w-full text-xs gradient-primary text-primary-foreground"
              onClick={handleApplyAll}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Aplicar Todas as Sugestões
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
