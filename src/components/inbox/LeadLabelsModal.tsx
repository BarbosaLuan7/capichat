import { useState, useMemo, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tag, Check, Plus, Search, X, ChevronDown } from 'lucide-react';
import { useLabels, useAddLeadLabel, useRemoveLeadLabel, useCreateLabel } from '@/hooks/useLabels';
import { LabelModal } from '@/components/labels/LabelModal';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type LabelCategory = Database['public']['Enums']['label_category'];

interface LeadLabelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentLabelIds: string[];
}

// Configuração de categorias com ícones e ordem
const categoryConfig: Record<string, { label: string; icon: string; order: number }> = {
  beneficio: { label: 'Tipo de Benefício', icon: '🎯', order: 1 },
  condicao_saude: { label: 'Condição de Saúde', icon: '🏥', order: 2 },
  interesse: { label: 'Interesse', icon: '⭐', order: 3 },
  status: { label: 'Status', icon: '📊', order: 4 },
  situacao: { label: 'Situação', icon: '📋', order: 5 },
  desqualificacao: { label: 'Desqualificação', icon: '❌', order: 6 },
  perda: { label: 'Motivo de Perda', icon: '💔', order: 7 },
  origem: { label: 'Origem/Campanha', icon: '📢', order: 8 },
  prioridade: { label: 'Prioridade', icon: '🔥', order: 9 },
};

export function LeadLabelsModal({
  open,
  onOpenChange,
  leadId,
  currentLabelIds,
}: LeadLabelsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { data: labels, isLoading } = useLabels();
  const addLabel = useAddLeadLabel();
  const removeLabel = useRemoveLeadLabel();
  const createLabel = useCreateLabel();

  const handleToggleLabel = async (labelId: string) => {
    if (currentLabelIds.includes(labelId)) {
      await removeLabel.mutateAsync({ leadId, labelId });
    } else {
      await addLabel.mutateAsync({ leadId, labelId });
    }
  };

  const handleCreateLabel = async (data: {
    name: string;
    color: string;
    category: LabelCategory;
  }) => {
    await createLabel.mutateAsync(data);
  };

  // Deduplica etiquetas por ID e filtra por termo de busca
  const uniqueLabels = useMemo(() => {
    if (!labels) return [];

    // Remove duplicatas pelo ID
    const seen = new Set<string>();
    const deduplicated = labels.filter((label) => {
      if (seen.has(label.id)) return false;
      seen.add(label.id);
      return true;
    });

    // Filtra pelo termo de busca (usando valor debounced)
    if (!debouncedSearchTerm.trim()) return deduplicated;

    const term = debouncedSearchTerm.toLowerCase();
    return deduplicated.filter(
      (label) =>
        label.name.toLowerCase().includes(term) || label.category.toLowerCase().includes(term)
    );
  }, [labels, debouncedSearchTerm]);

  // Etiquetas selecionadas
  const selectedLabels = useMemo(() => {
    return uniqueLabels.filter((label) => currentLabelIds.includes(label.id));
  }, [uniqueLabels, currentLabelIds]);

  // Agrupar por categoria e ordenar
  const groupedLabels = useMemo(() => {
    const groups = uniqueLabels.reduce(
      (acc, label) => {
        const category = label.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(label);
        return acc;
      },
      {} as Record<string, typeof uniqueLabels>
    );

    // Ordenar por ordem definida
    return Object.entries(groups).sort(([a], [b]) => {
      const orderA = categoryConfig[a]?.order ?? 99;
      const orderB = categoryConfig[b]?.order ?? 99;
      return orderA - orderB;
    });
  }, [uniqueLabels]);

  // Categorias que têm labels selecionadas iniciam abertas
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Auto-expandir categorias com selecionados quando abre o modal
  useEffect(() => {
    if (open) {
      const initial: Record<string, boolean> = {};
      groupedLabels.forEach(([category, categoryLabels]) => {
        initial[category] = categoryLabels.some((l) => currentLabelIds.includes(l.id));
      });
      setOpenCategories(initial);
    }
  }, [open, groupedLabels, currentLabelIds]);

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Etiquetas do Lead
            </DialogTitle>
            <DialogDescription>Selecione as etiquetas para associar a este lead.</DialogDescription>
          </DialogHeader>

          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar etiqueta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Etiquetas selecionadas (sempre visível) */}
          {selectedLabels.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <Check className="h-4 w-4" />
                Etiquetas aplicadas ({selectedLabels.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedLabels.map((label) => (
                  <Badge
                    key={label.id}
                    onClick={() => handleToggleLabel(label.id)}
                    className="cursor-pointer gap-1 pr-1 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: label.color, color: 'white' }}
                  >
                    {label.name}
                    <X className="ml-1 h-3 w-3 rounded-full hover:bg-white/20" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <ScrollArea className="max-h-72">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-2 pr-4">
                {groupedLabels.map(([category, categoryLabels]) => {
                  const config = categoryConfig[category] || {
                    label: category,
                    icon: '📁',
                    order: 99,
                  };
                  const isOpen = openCategories[category] ?? false;
                  const selectedCount = categoryLabels.filter((l) =>
                    currentLabelIds.includes(l.id)
                  ).length;

                  return (
                    <Collapsible
                      key={category}
                      open={isOpen}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          <span className="text-sm font-medium">{config.label}</span>
                          <Badge variant="secondary" className="h-5 text-xs">
                            {categoryLabels.length}
                          </Badge>
                          {selectedCount > 0 && (
                            <Badge className="h-5 border-0 bg-primary/20 text-xs text-primary">
                              {selectedCount} aplicada{selectedCount > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-2 pb-3 pt-2">
                        <div className="flex flex-wrap gap-2">
                          {categoryLabels.map((label) => {
                            const isSelected = currentLabelIds.includes(label.id);
                            return (
                              <Button
                                key={label.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleLabel(label.id)}
                                className={cn(
                                  'h-7 gap-1.5 text-xs transition-all',
                                  isSelected && 'shadow-sm ring-2 ring-offset-1'
                                )}
                                style={{
                                  borderColor: label.color,
                                  color: isSelected ? 'white' : label.color,
                                  backgroundColor: isSelected ? label.color : 'transparent',
                                  ['--tw-ring-color' as string]: label.color,
                                }}
                              >
                                {isSelected ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Plus className="h-3 w-3 opacity-50" />
                                )}
                                {label.name}
                              </Button>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}

                {groupedLabels.length === 0 && searchTerm && (
                  <div className="py-8 text-center text-muted-foreground">
                    Nenhuma etiqueta encontrada para "{searchTerm}"
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <DialogFooter className="flex flex-row justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar nova etiqueta
            </Button>
            <Button onClick={() => onOpenChange(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de criação de etiqueta */}
      <LabelModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSave={handleCreateLabel}
      />
    </>
  );
}
