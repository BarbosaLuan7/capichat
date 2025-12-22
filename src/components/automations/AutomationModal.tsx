import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { Automation, AutomationTrigger, AutomationAction, AutomationCondition, AutomationActionConfig } from '@/types';
import { mockUsers, mockFunnelStages, mockLabels } from '@/data/mockData';

const automationSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  isActive: z.boolean(),
  trigger: z.string().min(1, 'Gatilho obrigatório'),
});

type AutomationFormData = z.infer<typeof automationSchema>;

interface AutomationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: Automation | null;
  onSave: (automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDelete?: (automationId: string) => void;
}

const triggerOptions: { value: AutomationTrigger; label: string }[] = [
  { value: 'lead_created', label: 'Novo lead criado' },
  { value: 'lead_stage_changed', label: 'Lead mudou de etapa' },
  { value: 'lead_temperature_changed', label: 'Temperatura do lead alterada' },
  { value: 'lead_no_response', label: 'Lead sem resposta' },
  { value: 'lead_label_added', label: 'Etiqueta adicionada ao lead' },
  { value: 'task_overdue', label: 'Tarefa vencida' },
  { value: 'conversation_no_response', label: 'Conversa sem resposta' },
];

const actionOptions: { value: AutomationAction; label: string }[] = [
  { value: 'move_lead_to_stage', label: 'Mover lead para etapa' },
  { value: 'change_lead_temperature', label: 'Alterar temperatura do lead' },
  { value: 'add_label', label: 'Adicionar etiqueta' },
  { value: 'remove_label', label: 'Remover etiqueta' },
  { value: 'create_task', label: 'Criar tarefa' },
  { value: 'notify_user', label: 'Notificar usuário' },
  { value: 'assign_to_user', label: 'Atribuir a usuário' },
  { value: 'send_message', label: 'Enviar mensagem' },
];

const conditionFields = [
  { value: 'stage', label: 'Etapa do funil' },
  { value: 'temperature', label: 'Temperatura' },
  { value: 'label', label: 'Etiqueta' },
  { value: 'source', label: 'Origem' },
  { value: 'hours_since_last_message', label: 'Horas sem mensagem' },
  { value: 'assigned_to', label: 'Atribuído a' },
];

const operatorOptions = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
];

export const AutomationModal = ({ open, onOpenChange, automation, onSave, onDelete }: AutomationModalProps) => {
  const [conditions, setConditions] = useState<AutomationCondition[]>(automation?.conditions || []);
  const [actions, setActions] = useState<AutomationActionConfig[]>(automation?.actions || []);

  const form = useForm<AutomationFormData>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
      trigger: '',
    },
  });

  useEffect(() => {
    if (automation) {
      form.reset({
        name: automation.name,
        description: automation.description || '',
        isActive: automation.isActive,
        trigger: automation.trigger,
      });
      setConditions(automation.conditions);
      setActions(automation.actions);
    } else {
      form.reset({
        name: '',
        description: '',
        isActive: true,
        trigger: '',
      });
      setConditions([]);
      setActions([]);
    }
  }, [automation, form]);

  const handleSubmit = (data: AutomationFormData) => {
    const automationData = {
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      trigger: data.trigger as AutomationTrigger,
      conditions,
      actions,
      createdBy: '1',
      ...(automation?.id && { id: automation.id }),
    };
    onSave(automationData);
    onOpenChange(false);
  };

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: 'stage', operator: 'equals', value: '' },
    ]);
  };

  const updateCondition = (index: number, updates: Partial<AutomationCondition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([
      ...actions,
      { type: 'notify_user', params: {} },
    ]);
  };

  const updateAction = (index: number, updates: Partial<AutomationActionConfig>) => {
    setActions(actions.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const renderActionParams = (action: AutomationActionConfig, index: number) => {
    switch (action.type) {
      case 'move_lead_to_stage':
        return (
          <Select
            value={action.params.stageId || ''}
            onValueChange={(v) => updateAction(index, { params: { ...action.params, stageId: v } })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecionar etapa" />
            </SelectTrigger>
            <SelectContent>
              {mockFunnelStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'change_lead_temperature':
        return (
          <Select
            value={action.params.temperature || ''}
            onValueChange={(v) => updateAction(index, { params: { ...action.params, temperature: v } })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecionar temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cold">Frio</SelectItem>
              <SelectItem value="warm">Morno</SelectItem>
              <SelectItem value="hot">Quente</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'add_label':
      case 'remove_label':
        return (
          <Select
            value={action.params.labelId || ''}
            onValueChange={(v) => updateAction(index, { params: { ...action.params, labelId: v } })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecionar etiqueta" />
            </SelectTrigger>
            <SelectContent>
              {mockLabels.map((label) => (
                <SelectItem key={label.id} value={label.id}>{label.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'notify_user':
      case 'assign_to_user':
        return (
          <div className="space-y-2">
            <Select
              value={action.params.userId || ''}
              onValueChange={(v) => updateAction(index, { params: { ...action.params, userId: v } })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned">Responsável atual</SelectItem>
                {mockUsers.filter(u => u.isActive).map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {action.type === 'notify_user' && (
              <Input
                placeholder="Mensagem da notificação (use {{lead_name}}, {{task_title}})"
                value={action.params.message || ''}
                onChange={(e) => updateAction(index, { params: { ...action.params, message: e.target.value } })}
              />
            )}
          </div>
        );
      case 'create_task':
        return (
          <div className="space-y-2">
            <Input
              placeholder="Título da tarefa"
              value={action.params.title || ''}
              onChange={(e) => updateAction(index, { params: { ...action.params, title: e.target.value } })}
            />
            <div className="flex gap-2">
              <Select
                value={action.params.priority || 'medium'}
                onValueChange={(v) => updateAction(index, { params: { ...action.params, priority: v } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Vence em (horas)"
                value={action.params.dueInHours || ''}
                onChange={(e) => updateAction(index, { params: { ...action.params, dueInHours: e.target.value } })}
              />
            </div>
          </div>
        );
      case 'send_message':
        return (
          <Textarea
            placeholder="Conteúdo da mensagem (use {{lead_name}})"
            value={action.params.content || ''}
            onChange={(e) => updateAction(index, { params: { ...action.params, content: e.target.value } })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{automation ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="flex items-center justify-between">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {field.value ? 'Ativa' : 'Inativa'}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

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

            <FormField
              control={form.control}
              name="trigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quando executar (Gatilho)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar gatilho" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {triggerOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Condições (opcional)</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              {conditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma condição. A automação será executada sempre que o gatilho ocorrer.</p>
              ) : (
                <div className="space-y-2">
                  {conditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <Select
                        value={condition.field}
                        onValueChange={(v) => updateCondition(index, { field: v as AutomationCondition['field'] })}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {conditionFields.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={condition.operator}
                        onValueChange={(v) => updateCondition(index, { operator: v as AutomationCondition['operator'] })}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operatorOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="flex-1"
                        placeholder="Valor"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Ações</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addAction}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Adicione pelo menos uma ação para a automação.</p>
              ) : (
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">Ação {index + 1}</Badge>
                        <Select
                          value={action.type}
                          onValueChange={(v) => updateAction(index, { type: v as AutomationAction, params: {} })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {actionOptions.map((a) => (
                              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeAction(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      {renderActionParams(action, index)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              {automation && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    onDelete(automation.id);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="gradient-primary text-primary-foreground" disabled={actions.length === 0}>
                  {automation ? 'Salvar' : 'Criar Automação'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
