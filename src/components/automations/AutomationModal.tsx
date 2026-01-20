import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConditionBuilder, AutomationCondition } from './ConditionBuilder';
import { ActionBuilder, AutomationActionConfig } from './ActionBuilder';
import type { Database } from '@/integrations/supabase/types';

type AutomationTrigger = Database['public']['Enums']['automation_trigger'];
type AutomationRow = Database['public']['Tables']['automations']['Row'];

const automationSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  is_active: z.boolean(),
  trigger: z.string().min(1, 'Gatilho obrigatório'),
});

type AutomationFormData = z.infer<typeof automationSchema>;

interface AutomationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: AutomationRow | null;
  onSave: (automation: {
    id?: string;
    name: string;
    description?: string;
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    actions: AutomationActionConfig[];
    is_active: boolean;
  }) => void;
  onDelete?: (automationId: string) => void;
  isSaving?: boolean;
}

const triggerOptions: { value: AutomationTrigger; label: string; description: string }[] = [
  {
    value: 'lead_created',
    label: 'Novo lead criado',
    description: 'Quando um novo lead é cadastrado no sistema',
  },
  {
    value: 'lead_stage_changed',
    label: 'Lead mudou de etapa',
    description: 'Quando um lead muda de etapa no funil',
  },
  {
    value: 'lead_temperature_changed',
    label: 'Temperatura alterada',
    description: 'Quando a temperatura do lead muda',
  },
  {
    value: 'lead_no_response',
    label: 'Lead sem resposta',
    description: 'Quando um lead não responde há X horas',
  },
  {
    value: 'lead_label_added',
    label: 'Etiqueta adicionada',
    description: 'Quando uma etiqueta é adicionada ao lead',
  },
  {
    value: 'task_overdue',
    label: 'Tarefa vencida',
    description: 'Quando uma tarefa passa da data de vencimento',
  },
  {
    value: 'conversation_no_response',
    label: 'Conversa sem resposta',
    description: 'Quando uma conversa fica sem resposta',
  },
];

export const AutomationModal = ({
  open,
  onOpenChange,
  automation,
  onSave,
  onDelete,
  isSaving = false,
}: AutomationModalProps) => {
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actions, setActions] = useState<AutomationActionConfig[]>([]);

  const form = useForm<AutomationFormData>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
      trigger: '',
    },
  });

  const watchTrigger = form.watch('trigger') as AutomationTrigger | '';

  useEffect(() => {
    if (automation) {
      form.reset({
        name: automation.name,
        description: automation.description || '',
        is_active: automation.is_active,
        trigger: automation.trigger,
      });
      const parsedConditions = Array.isArray(automation.conditions)
        ? (automation.conditions as unknown as AutomationCondition[])
        : [];
      const parsedActions = Array.isArray(automation.actions)
        ? (automation.actions as unknown as AutomationActionConfig[])
        : [];
      setConditions(parsedConditions);
      setActions(parsedActions);
    } else {
      form.reset({
        name: '',
        description: '',
        is_active: true,
        trigger: '',
      });
      setConditions([]);
      setActions([]);
    }
  }, [automation, form, open]);

  const handleSubmit = (data: AutomationFormData) => {
    onSave({
      name: data.name,
      description: data.description,
      is_active: data.is_active,
      trigger: data.trigger as AutomationTrigger,
      conditions,
      actions,
      ...(automation?.id && { id: automation.id }),
    });
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'stage_id', operator: 'equals', value: '' }]);
  };

  const updateCondition = (index: number, updates: Partial<AutomationCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([...actions, { type: 'notify_user', params: {} }]);
  };

  const updateAction = (index: number, updates: Partial<AutomationActionConfig>) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const selectedTrigger = triggerOptions.find((t) => t.value === watchTrigger);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-[800px]">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle className="text-xl">
            {automation ? 'Editar Automação' : 'Nova Automação'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pb-6">
              {/* Status Toggle */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">
                          {field.value ? (
                            <Badge variant="default" className="bg-success">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                {automation && onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(automation.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Excluir
                  </Button>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da automação</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Notificar gestor para leads quentes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o que esta automação faz..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Trigger Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Gatilho</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          O gatilho define quando a automação será executada
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <FormField
                  control={form.control}
                  name="trigger"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecionar gatilho" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {triggerOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div>
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {opt.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedTrigger && (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    💡 {selectedTrigger.description}
                  </p>
                )}
              </div>

              <Separator />

              {/* Conditions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Condições</h3>
                    <Badge variant="secondary" className="text-xs">
                      Opcional
                    </Badge>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar condição
                  </Button>
                </div>

                {conditions.length === 0 ? (
                  <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                    Nenhuma condição definida. A automação será executada sempre que o gatilho
                    ocorrer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conditions.map((condition, index) => (
                      <ConditionBuilder
                        key={index}
                        condition={condition}
                        index={index}
                        trigger={watchTrigger}
                        onUpdate={updateCondition}
                        onRemove={removeCondition}
                      />
                    ))}
                    {conditions.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Todas as condições devem ser verdadeiras para a automação executar (E
                        lógico)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Ações</h3>
                    <Badge variant="default" className="text-xs">
                      Obrigatório
                    </Badge>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAction}>
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar ação
                  </Button>
                </div>

                {actions.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-center text-sm text-muted-foreground">
                    ⚠️ Adicione pelo menos uma ação para a automação funcionar
                  </div>
                ) : (
                  <div className="space-y-3">
                    {actions.map((action, index) => (
                      <ActionBuilder
                        key={index}
                        action={action}
                        index={index}
                        onUpdate={updateAction}
                        onRemove={removeAction}
                      />
                    ))}
                    {actions.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        💡 As ações serão executadas na ordem em que aparecem
                      </p>
                    )}
                  </div>
                )}
              </div>
            </form>
          </Form>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isSaving || actions.length === 0}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar automação'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
