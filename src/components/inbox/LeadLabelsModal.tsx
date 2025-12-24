import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tag, Check, Plus, Search } from 'lucide-react';
import { useLabels, useAddLeadLabel, useRemoveLeadLabel } from '@/hooks/useLabels';
import { cn } from '@/lib/utils';

interface LeadLabelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentLabelIds: string[];
}

export function LeadLabelsModal({
  open,
  onOpenChange,
  leadId,
  currentLabelIds,
}: LeadLabelsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: labels, isLoading } = useLabels();
  const addLabel = useAddLeadLabel();
  const removeLabel = useRemoveLeadLabel();

  const handleToggleLabel = async (labelId: string) => {
    if (currentLabelIds.includes(labelId)) {
      await removeLabel.mutateAsync({ leadId, labelId });
    } else {
      await addLabel.mutateAsync({ leadId, labelId });
    }
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
    
    // Filtra pelo termo de busca
    if (!searchTerm.trim()) return deduplicated;
    
    const term = searchTerm.toLowerCase();
    return deduplicated.filter(
      (label) =>
        label.name.toLowerCase().includes(term) ||
        label.category.toLowerCase().includes(term)
    );
  }, [labels, searchTerm]);

  const groupedLabels = uniqueLabels.reduce((acc, label) => {
    const category = label.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(label);
    return acc;
  }, {} as Record<string, typeof uniqueLabels>);

  const categoryNames: Record<string, string> = {
    origem: 'Origem',
    interesse: 'Interesse',
    prioridade: 'Prioridade',
    status: 'Status',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedLabels).map(([category, categoryLabels]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {categoryNames[category] || category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {categoryLabels?.map((label) => {
                      const isSelected = currentLabelIds.includes(label.id);
                      return (
                        <Button
                          key={label.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleLabel(label.id)}
                          className={cn(
                            'gap-2 transition-all',
                            isSelected && 'ring-2 ring-offset-2'
                          )}
                          style={{
                            borderColor: label.color,
                            color: isSelected ? 'white' : label.color,
                            backgroundColor: isSelected ? label.color : 'transparent',
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {label.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
