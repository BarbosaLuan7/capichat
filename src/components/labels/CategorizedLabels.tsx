import { useMemo } from 'react';
import { Tag, Folder, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Label {
  id: string;
  name: string;
  color: string;
  category: string;
}

interface CategorizedLabelsProps {
  labels: Label[];
  selectedLabelIds?: string[];
  onToggleLabel?: (labelId: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

// Mapeamento de categorias com ícones e nomes em português
const categoryConfig: Record<string, { label: string; icon: string; order: number }> = {
  beneficio: { label: 'Benefício', icon: '🎯', order: 1 },
  condicao_saude: { label: 'Condição de Saúde', icon: '🏥', order: 2 },
  interesse: { label: 'Interesse', icon: '⭐', order: 3 },
  status: { label: 'Status', icon: '📊', order: 4 },
  situacao: { label: 'Situação', icon: '📋', order: 5 },
  desqualificacao: { label: 'Desqualificação', icon: '❌', order: 6 },
  perda: { label: 'Perda', icon: '💔', order: 7 },
};

export function CategorizedLabels({
  labels,
  selectedLabelIds = [],
  onToggleLabel,
  readOnly = false,
  compact = false,
}: CategorizedLabelsProps) {
  // Agrupar labels por categoria
  const groupedLabels = useMemo(() => {
    const groups: Record<string, Label[]> = {};

    labels.forEach((label) => {
      const category = label.category || 'status';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(label);
    });

    // Ordenar categorias
    return Object.entries(groups).sort((a, b) => {
      const orderA = categoryConfig[a[0]]?.order ?? 99;
      const orderB = categoryConfig[b[0]]?.order ?? 99;
      return orderA - orderB;
    });
  }, [labels]);

  if (labels.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <Tag className="mx-auto mb-2 h-6 w-6 opacity-50" />
        Nenhuma etiqueta disponível
      </div>
    );
  }

  // Modo compacto para exibição inline
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {groupedLabels.map(([category, categoryLabels]) => (
          <div key={category} className="flex items-center gap-1">
            <span className="mr-0.5 text-xs opacity-60">
              {categoryConfig[category]?.icon || '🏷️'}
            </span>
            {categoryLabels
              .filter((l) => selectedLabelIds.includes(l.id))
              .map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="px-1.5 py-0 text-xs"
                  style={{
                    borderColor: label.color,
                    color: label.color,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-96">
      <div className="space-y-4 p-1">
        {groupedLabels.map(([category, categoryLabels], index) => (
          <div key={category}>
            {index > 0 && <Separator className="mb-4" />}

            {/* Header da categoria */}
            <div className="mb-2 flex items-center gap-2">
              <span className="text-base">{categoryConfig[category]?.icon || '🏷️'}</span>
              <span className="text-sm font-medium text-muted-foreground">
                {categoryConfig[category]?.label || category}
              </span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {categoryLabels.length}
              </Badge>
            </div>

            {/* Labels da categoria */}
            <div className="flex flex-wrap gap-2">
              {categoryLabels.map((label) => {
                const isSelected = selectedLabelIds.includes(label.id);

                if (readOnly) {
                  return (
                    <Badge
                      key={label.id}
                      variant="outline"
                      style={{
                        borderColor: label.color,
                        backgroundColor: isSelected ? label.color : 'transparent',
                        color: isSelected ? 'white' : label.color,
                      }}
                    >
                      {label.name}
                    </Badge>
                  );
                }

                return (
                  <Button
                    key={label.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleLabel?.(label.id)}
                    className={cn('gap-1.5 transition-all', isSelected && 'ring-2 ring-offset-1')}
                    style={{
                      borderColor: label.color,
                      backgroundColor: isSelected ? label.color : 'transparent',
                      color: isSelected ? 'white' : label.color,
                    }}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {label.name}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Componente para exibição resumida de etiquetas por categoria
export function CategorizedLabelsSummary({
  labels,
  maxVisible = 3,
}: {
  labels: Label[];
  maxVisible?: number;
}) {
  const groupedLabels = useMemo(() => {
    const groups: Record<string, Label[]> = {};

    labels.forEach((label) => {
      const category = label.category || 'status';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(label);
    });

    return Object.entries(groups).sort((a, b) => {
      const orderA = categoryConfig[a[0]]?.order ?? 99;
      const orderB = categoryConfig[b[0]]?.order ?? 99;
      return orderA - orderB;
    });
  }, [labels]);

  const visibleLabels = labels.slice(0, maxVisible);
  const hiddenCount = labels.length - maxVisible;

  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleLabels.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className="px-1.5 py-0 text-xs"
          style={{
            borderColor: label.color,
            color: label.color,
          }}
        >
          <span className="text-2xs mr-0.5 opacity-70">{categoryConfig[label.category]?.icon}</span>
          {label.name}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="px-1.5 py-0 text-xs">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
