import { X, GripVertical, Info } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLabels } from '@/hooks/useLabels';
import { useProfiles } from '@/hooks/useProfiles';
import { useTemplates } from '@/hooks/useTemplates';
import type { Database } from '@/integrations/supabase/types';

type AutomationAction = Database['public']['Enums']['automation_action'];

export interface AutomationActionConfig {
  type: AutomationAction;
  params: Record<string, string>;
}

interface ActionBuilderProps {
  action: AutomationActionConfig;
  index: number;
  onUpdate: (index: number, updates: Partial<AutomationActionConfig>) => void;
  onRemove: (index: number) => void;
}

const actionOptions: { value: AutomationAction; label: string; description: string }[] = [
  {
    value: 'move_lead_to_stage',
    label: 'Mover lead para etapa',
    description: 'Move o lead para uma etapa específica do funil',
  },
  {
    value: 'change_lead_temperature',
    label: 'Alterar temperatura',
    description: 'Muda a temperatura do lead (frio/morno/quente)',
  },
  { value: 'add_label', label: 'Adicionar etiqueta', description: 'Adiciona uma etiqueta ao lead' },
  { value: 'remove_label', label: 'Remover etiqueta', description: 'Remove uma etiqueta do lead' },
  {
    value: 'create_task',
    label: 'Criar tarefa',
    description: 'Cria uma nova tarefa vinculada ao lead',
  },
  {
    value: 'notify_user',
    label: 'Notificar usuário',
    description: 'Envia uma notificação para um usuário',
  },
  {
    value: 'assign_to_user',
    label: 'Atribuir a usuário',
    description: 'Atribui o lead a um usuário específico',
  },
  {
    value: 'send_message',
    label: 'Enviar mensagem',
    description: 'Envia uma mensagem automática para o lead',
  },
];

const placeholderHelp = {
  lead: '{{lead_name}}, {{lead_phone}}, {{lead_email}}',
  task: '{{task_title}}, {{task_due_date}}',
  general: '{{date}}, {{time}}',
};

export const ActionBuilder = ({ action, index, onUpdate, onRemove }: ActionBuilderProps) => {
  const { data: funnelStages = [] } = useFunnelStages();
  const { data: labels = [] } = useLabels();
  const { data: profiles = [] } = useProfiles();
  const { data: templates = [] } = useTemplates();

  const updateParams = (key: string, value: string) => {
    onUpdate(index, { params: { ...action.params, [key]: value } });
  };

  const renderActionParams = () => {
    switch (action.type) {
      case 'move_lead_to_stage':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Etapa de destino</Label>
            <Select
              value={action.params.stageId || ''}
              onValueChange={(v) => updateParams('stageId', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar etapa" />
              </SelectTrigger>
              <SelectContent>
                {funnelStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'change_lead_temperature':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Nova temperatura</Label>
            <Select
              value={action.params.temperature || ''}
              onValueChange={(v) => updateParams('temperature', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cold">🧊 Frio</SelectItem>
                <SelectItem value="warm">🌤️ Morno</SelectItem>
                <SelectItem value="hot">🔥 Quente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'add_label':
      case 'remove_label':
        return (
          <div className="space-y-2">
            <Label className="text-xs">
              {action.type === 'add_label' ? 'Etiqueta a adicionar' : 'Etiqueta a remover'}
            </Label>
            <Select
              value={action.params.labelId || ''}
              onValueChange={(v) => updateParams('labelId', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar etiqueta" />
              </SelectTrigger>
              <SelectContent>
                {labels.map((label) => (
                  <SelectItem key={label.id} value={label.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'notify_user':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Usuário a notificar</Label>
              <Select
                value={action.params.userId || ''}
                onValueChange={(v) => updateParams('userId', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">👤 Responsável atual do lead</SelectItem>
                  {profiles
                    .filter((u) => u.is_active)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Título da notificação</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Placeholders: {placeholderHelp.lead}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                placeholder="Ex: Novo lead quente!"
                value={action.params.title || ''}
                onChange={(e) => updateParams('title', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                placeholder="Ex: O lead {{lead_name}} precisa de atenção"
                value={action.params.message || ''}
                onChange={(e) => updateParams('message', e.target.value)}
                rows={2}
              />
            </div>
          </div>
        );

      case 'assign_to_user':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Atribuir a</Label>
            <Select
              value={action.params.userId || ''}
              onValueChange={(v) => updateParams('userId', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar usuário" />
              </SelectTrigger>
              <SelectContent>
                {profiles
                  .filter((u) => u.is_active)
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'create_task':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Título da tarefa</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Placeholders: {placeholderHelp.lead}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                placeholder="Ex: Entrar em contato com {{lead_name}}"
                value={action.params.title || ''}
                onChange={(e) => updateParams('title', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes da tarefa..."
                value={action.params.description || ''}
                onChange={(e) => updateParams('description', e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={action.params.priority || 'medium'}
                  onValueChange={(v) => updateParams('priority', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 Urgente</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="low">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Vence em (horas)</Label>
                <Input
                  type="number"
                  placeholder="24"
                  value={action.params.dueInHours || ''}
                  onChange={(e) => updateParams('dueInHours', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Atribuir a</Label>
              <Select
                value={action.params.assignTo || 'assigned'}
                onValueChange={(v) => updateParams('assignTo', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">👤 Responsável do lead</SelectItem>
                  {profiles
                    .filter((u) => u.is_active)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'send_message':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Usar template (opcional)</Label>
              <Select
                value={action.params.templateId || ''}
                onValueChange={(v) => {
                  const template = templates.find((t) => t.id === v);
                  updateParams('templateId', v);
                  if (template) {
                    updateParams('content', template.content);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Mensagem personalizada</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Conteúdo da mensagem</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Placeholders: {placeholderHelp.lead}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                placeholder="Ex: Olá {{lead_name}}, tudo bem?"
                value={action.params.content || ''}
                onChange={(e) => updateParams('content', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const selectedAction = actionOptions.find((a) => a.value === action.type);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 cursor-move text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Select
                value={action.type}
                onValueChange={(v) => onUpdate(index, { type: v as AutomationAction, params: {} })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar ação" />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <div>{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {selectedAction && (
            <p className="text-xs text-muted-foreground">{selectedAction.description}</p>
          )}

          {renderActionParams()}
        </div>
      </div>
    </div>
  );
};
