import { useEffect } from 'react';
import { Check, CheckCircle2, Circle, FileCheck, ListChecks, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export function DocumentChecklist({
  leadId,
  customFields,
  labels = [],
  onUpdate,
}: DocumentChecklistProps) {
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
  const groupedDocuments =
    currentBenefit?.documents.reduce(
      (acc, doc) => {
        if (!acc[doc.category]) {
          acc[doc.category] = [];
        }
        acc[doc.category].push(doc);
        return acc;
      },
      {} as Record<string, DocumentItem[]>
    ) || {};

  return (
    <div className="space-y-4">
      {/* Header com seletor de benefício */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <FileCheck className="h-3 w-3" />
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
              className={cn('h-2', progress.percentage === 100 && '[&>div]:bg-success')}
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
              <ListChecks className="mr-1 h-3 w-3" />
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
              <Trash2 className="mr-1 h-3 w-3" />
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
                          'flex cursor-pointer items-start gap-2 rounded-md p-2 transition-colors',
                          isChecked
                            ? 'border border-success/20 bg-success/10'
                            : 'border border-transparent bg-muted/50 hover:bg-muted'
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm',
                                isChecked && 'text-muted-foreground line-through'
                              )}
                            >
                              {doc.name}
                            </span>
                            {doc.required && (
                              <Badge variant="outline" className="text-2xs h-4 px-1 py-0">
                                Obrigatório
                              </Badge>
                            )}
                          </div>
                          {doc.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        {isChecked && (
                          <CheckCircle2
                            className="h-4 w-4 flex-shrink-0 text-success"
                            aria-hidden="true"
                          />
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
            <div className="flex animate-pulse items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              {isSaving ? (
                <>
                  <Check className="h-3 w-3" />
                  Salvando...
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3" />
                  Alterações pendentes...
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Estado vazio */}
      {!benefitType && (
        <div className="py-6 text-center text-muted-foreground">
          <FileCheck className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">
            Selecione o tipo de benefício para ver a lista de documentos necessários
          </p>
        </div>
      )}
    </div>
  );
}
