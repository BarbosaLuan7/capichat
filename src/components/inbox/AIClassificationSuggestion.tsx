import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ThermometerSun, Tag, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AIClassificationSuggestionProps {
  classification: {
    suggestedBenefit?: string;
    suggestedTemperature: 'cold' | 'warm' | 'hot';
    suggestedLabels: string[];
    healthConditions?: string[];
    reasoning: string;
    confidence: 'low' | 'medium' | 'high';
  };
  currentTemperature?: string;
  currentLabels?: string[];
  availableLabels?: { id: string; name: string; color: string }[];
  isLoading: boolean;
  onApplyTemperature: (temp: 'cold' | 'warm' | 'hot') => void;
  onApplyLabel: (labelId: string) => void;
  onApplyAll: () => void;
  onDismiss: () => void;
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
  classification,
  currentTemperature,
  currentLabels = [],
  availableLabels = [],
  isLoading,
  onApplyTemperature,
  onApplyLabel,
  onApplyAll,
  onDismiss,
}: AIClassificationSuggestionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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

  const temperatureChanged = classification.suggestedTemperature !== currentTemperature;
  const newLabels = classification.suggestedLabels.filter(
    (name) => !currentLabels?.includes(name)
  );
  const hasChanges = temperatureChanged || newLabels.length > 0;

  if (!hasChanges) {
    return null;
  }

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
          <span className="text-xs font-medium text-primary">Sugestões da IA</span>
          <Badge variant="outline" className={cn('text-xs px-1.5', confidenceLabels[classification.confidence].color)}>
            Confiança: {confidenceLabels[classification.confidence].label}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
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
            onClick={onDismiss}
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
                onClick={() => onApplyTemperature(classification.suggestedTemperature)}
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
                  const label = availableLabels.find((l) => l.name === labelName);
                  if (!label) return null;
                  return (
                    <Badge
                      key={label.id}
                      className="text-xs cursor-pointer hover:opacity-80 border-0 gap-1"
                      style={{ backgroundColor: label.color, color: 'white' }}
                      onClick={() => onApplyLabel(label.id)}
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
              onClick={onApplyAll}
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
