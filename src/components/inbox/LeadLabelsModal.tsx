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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

  const handleCreateLabel = async (data: { name: string; color: string; category: LabelCategory }) => {
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
        label.name.toLowerCase().includes(term) ||
        label.category.toLowerCase().includes(term)
    );
  }, [labels, debouncedSearchTerm]);

  // Etiquetas selecionadas
  const selectedLabels = useMemo(() => {
    return uniqueLabels.filter((label) => currentLabelIds.includes(label.id));
  }, [uniqueLabels, currentLabelIds]);

  // Agrupar por categoria e ordenar
  const groupedLabels = useMemo(() => {
    const groups = uniqueLabels.reduce((acc, label) => {
      const category = label.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(label);
      return acc;
    }, {} as Record<string, typeof uniqueLabels>);

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
              <Tag className="w-5 h-5" />
              Etiquetas do Lead
            </DialogTitle>
            <DialogDescription>
              Selecione as etiquetas para associar a este lead.
            </DialogDescription>
          </DialogHeader>

          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar etiqueta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Etiquetas selecionadas (sempre visível) */}
          {selectedLabels.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-primary">
                <Check className="w-4 h-4" />
                Etiquetas aplicadas ({selectedLabels.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedLabels.map((label) => (
                  <Badge
                    key={label.id}
                    onClick={() => handleToggleLabel(label.id)}
                    className="cursor-pointer hover:opacity-80 transition-opacity gap-1 pr-1"
                    style={{ backgroundColor: label.color, color: 'white' }}
                  >
                    {label.name}
                    <X className="w-3 h-3 ml-1 hover:bg-white/20 rounded-full" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <ScrollArea className="max-h-72">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {groupedLabels.map(([category, categoryLabels]) => {
                  const config = categoryConfig[category] || { label: category, icon: '📁', order: 99 };
                  const isOpen = openCategories[category] ?? false;
                  const selectedCount = categoryLabels.filter((l) => currentLabelIds.includes(l.id)).length;

                  return (
                    <Collapsible
                      key={category}
                      open={isOpen}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          <span className="font-medium text-sm">{config.label}</span>
                          <Badge variant="secondary" className="text-xs h-5">
                            {categoryLabels.length}
                          </Badge>
                          {selectedCount > 0 && (
                            <Badge className="text-xs h-5 bg-primary/20 text-primary border-0">
                              {selectedCount} aplicada{selectedCount > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-muted-foreground transition-transform duration-200',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 pb-3 px-2">
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
                                  'gap-1.5 transition-all h-7 text-xs',
                                  isSelected && 'ring-2 ring-offset-1 shadow-sm'
                                )}
                                style={{
                                  borderColor: label.color,
                                  color: isSelected ? 'white' : label.color,
                                  backgroundColor: isSelected ? label.color : 'transparent',
                                  ['--tw-ring-color' as string]: label.color,
                                }}
                              >
                                {isSelected ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Plus className="w-3 h-3 opacity-50" />
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
                  <div className="text-center text-muted-foreground py-8">
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
              <Plus className="w-4 h-4" />
              Criar nova etiqueta
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Concluir
            </Button>
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
