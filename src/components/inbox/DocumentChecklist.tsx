import { useEffect } from 'react';
import { Check, CheckCircle2, Circle, FileCheck, ListChecks, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDocumentChecklist } from '@/hooks/useDocumentChecklist';
import {
  benefitDocuments,
  getDocumentsByBenefitType,
  detectBenefitTypeFromLabels,
  categoryIcons,
  categoryLabels,
  type BenefitType,
  type DocumentItem,
} from '@/lib/documentChecklist';

interface DocumentChecklistProps {
  leadId: string;
  customFields: Record<string, any> | null;
  labels?: { id: string; name: string }[];
  onUpdate?: () => void;
}

export function DocumentChecklist({ leadId, customFields, labels = [], onUpdate }: DocumentChecklistProps) {
  const {
    benefitType,
    setBenefitType,
    toggleDocument,
    checkAll,
    uncheckAll,
    getProgress,
    isDocumentChecked,
    isSaving,
    pendingSave,
  } = useDocumentChecklist({
    leadId,
    customFields,
    onSuccess: onUpdate,
  });

  // Auto-detecta tipo de benefício pelas etiquetas
  useEffect(() => {
    if (!benefitType && labels.length > 0) {
      const detected = detectBenefitTypeFromLabels(labels);
      if (detected) {
        setBenefitType(detected);
      }
    }
  }, [labels, benefitType, setBenefitType]);

  const currentBenefit = benefitType ? getDocumentsByBenefitType(benefitType) : null;
  const progress = getProgress();

  // Agrupa documentos por categoria
  const groupedDocuments = currentBenefit?.documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, DocumentItem[]>) || {};

  return (
    <div className="space-y-4">
      {/* Header com seletor de benefício */}
      <div className="space-y-2">
        <h4 className="font-medium text-xs text-muted-foreground uppercase flex items-center gap-2">
          <FileCheck className="w-3 h-3" />
          Checklist de Documentos
        </h4>
        
        <Select
          value={benefitType || ''}
          onValueChange={(value) => setBenefitType(value as BenefitType)}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Selecione o tipo de benefício" />
          </SelectTrigger>
          <SelectContent>
            {benefitDocuments.map((benefit) => (
              <SelectItem key={benefit.type} value={benefit.type}>
                <span className="flex items-center gap-2">
                  <span>{benefit.icon}</span>
                  <span>{benefit.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progresso e ações */}
      {currentBenefit && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.checked} de {progress.total} documentos
              </span>
              <Badge 
                variant={progress.percentage === 100 ? 'default' : 'secondary'}
                className={cn(
                  'text-xs',
                  progress.percentage === 100 && 'bg-success text-success-foreground'
                )}
              >
                {progress.percentage}%
              </Badge>
            </div>
            <Progress 
              value={progress.percentage} 
              className={cn(
                'h-2',
                progress.percentage === 100 && '[&>div]:bg-success'
              )}
            />
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={checkAll}
              disabled={isSaving || progress.checked === progress.total}
              aria-label="Marcar todos os documentos como entregues"
            >
              <ListChecks className="w-3 h-3 mr-1" />
              Marcar todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={uncheckAll}
              disabled={isSaving || progress.checked === 0}
              aria-label="Limpar todos os documentos marcados"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Limpar
            </Button>
          </div>

          {/* Lista de documentos por categoria */}
          <div className="space-y-4">
            {Object.entries(groupedDocuments).map(([category, docs]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>{categoryIcons[category as keyof typeof categoryIcons]}</span>
                  <span>{categoryLabels[category as keyof typeof categoryLabels]}</span>
                </div>
                <div className="space-y-1">
                {docs.map((doc) => {
                    const isChecked = isDocumentChecked(doc.id);
                    const checkboxId = `doc-${doc.id}`;
                    return (
                      <label
                        key={doc.id}
                        htmlFor={checkboxId}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-md transition-colors cursor-pointer',
                          isChecked 
                            ? 'bg-success/10 border border-success/20' 
                            : 'bg-muted/50 hover:bg-muted border border-transparent'
                        )}
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={isChecked}
                          onCheckedChange={() => toggleDocument(doc.id)}
                          className={cn(
                            'mt-0.5',
                            isChecked && 'border-success data-[state=checked]:bg-success'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-sm',
                              isChecked && 'line-through text-muted-foreground'
                            )}>
                              {doc.name}
                            </span>
                            {doc.required && (
                              <Badge variant="outline" className="text-2xs px-1 py-0 h-4">
                                Obrigatório
                              </Badge>
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        {isChecked && (
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Status de salvamento */}
          {(isSaving || pendingSave) && (
            <div className="text-xs text-muted-foreground text-center animate-pulse flex items-center justify-center gap-1.5">
              {isSaving ? (
                <>
                  <Check className="w-3 h-3" />
                  Salvando...
                </>
              ) : (
                <>
                  <Circle className="w-3 h-3" />
                  Alterações pendentes...
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Estado vazio */}
      {!benefitType && (
        <div className="text-center py-6 text-muted-foreground">
          <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione o tipo de benefício para ver a lista de documentos necessários</p>
        </div>
      )}
    </div>
  );
}
