import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLabels } from '@/hooks/useLabels';
import { useProfiles } from '@/hooks/useProfiles';
import type { Database } from '@/integrations/supabase/types';

type AutomationTrigger = Database['public']['Enums']['automation_trigger'];

export interface AutomationCondition {
  field: string;
  operator: string;
  value: string;
}

interface ConditionBuilderProps {
  condition: AutomationCondition;
  index: number;
  trigger: AutomationTrigger | '';
  onUpdate: (index: number, updates: Partial<AutomationCondition>) => void;
  onRemove: (index: number) => void;
}

// Fields available based on trigger type
const getConditionFieldsForTrigger = (trigger: AutomationTrigger | ''): { value: string; label: string; type: 'select' | 'text' | 'number' }[] => {
  const commonFields = [
    { value: 'source', label: 'Origem do lead', type: 'text' as const },
    { value: 'utm_medium', label: 'UTM Medium', type: 'text' as const },
  ];

  switch (trigger) {
    case 'lead_created':
      return [
        ...commonFields,
        { value: 'phone', label: 'Telefone (contém)', type: 'text' },
        { value: 'name', label: 'Nome (contém)', type: 'text' },
      ];
    case 'lead_stage_changed':
      return [
        { value: 'previous_stage_id', label: 'Etapa anterior', type: 'select' },
        { value: 'new_stage_id', label: 'Nova etapa', type: 'select' },
        ...commonFields,
      ];
    case 'lead_temperature_changed':
      return [
        { value: 'previous_temperature', label: 'Temperatura anterior', type: 'select' },
        { value: 'new_temperature', label: 'Nova temperatura', type: 'select' },
        ...commonFields,
      ];
    case 'lead_label_added':
      return [
        { value: 'label_id', label: 'Etiqueta adicionada', type: 'select' },
        ...commonFields,
      ];
    case 'lead_no_response':
    case 'conversation_no_response':
      return [
        { value: 'hours_since_last_message', label: 'Horas sem resposta', type: 'number' },
        { value: 'stage_id', label: 'Etapa do funil', type: 'select' },
        { value: 'temperature', label: 'Temperatura', type: 'select' },
        { value: 'assigned_to', label: 'Atribuído a', type: 'select' },
        ...commonFields,
      ];
    case 'task_overdue':
      return [
        { value: 'task_priority', label: 'Prioridade da tarefa', type: 'select' },
        { value: 'hours_overdue', label: 'Horas em atraso', type: 'number' },
        ...commonFields,
      ];
    default:
      return [
        { value: 'stage_id', label: 'Etapa do funil', type: 'select' },
        { value: 'temperature', label: 'Temperatura', type: 'select' },
        { value: 'assigned_to', label: 'Atribuído a', type: 'select' },
        ...commonFields,
      ];
  }
};

const operatorOptions = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'in', label: 'Está em' },
  { value: 'not_in', label: 'Não está em' },
];

export const ConditionBuilder = ({
  condition,
  index,
  trigger,
  onUpdate,
  onRemove,
}: ConditionBuilderProps) => {
  const { data: funnelStages = [] } = useFunnelStages();
  const { data: labels = [] } = useLabels();
  const { data: profiles = [] } = useProfiles();

  const conditionFields = getConditionFieldsForTrigger(trigger);
  const selectedField = conditionFields.find(f => f.value === condition.field);

  const renderValueInput = () => {
    const field = condition.field;

    // Stage selectors
    if (field === 'stage_id' || field === 'previous_stage_id' || field === 'new_stage_id') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onUpdate(index, { value: v })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar etapa" />
          </SelectTrigger>
          <SelectContent>
            {funnelStages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Temperature selector
    if (field === 'temperature' || field === 'previous_temperature' || field === 'new_temperature') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onUpdate(index, { value: v })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cold">🧊 Frio</SelectItem>
            <SelectItem value="warm">🌤️ Morno</SelectItem>
            <SelectItem value="hot">🔥 Quente</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Label selector
    if (field === 'label_id') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onUpdate(index, { value: v })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar etiqueta" />
          </SelectTrigger>
          <SelectContent>
            {labels.map((label) => (
              <SelectItem key={label.id} value={label.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // User selector
    if (field === 'assigned_to') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onUpdate(index, { value: v })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">Não atribuído</SelectItem>
            {profiles.filter(p => p.is_active).map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Priority selector
    if (field === 'task_priority') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onUpdate(index, { value: v })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">🔴 Urgente</SelectItem>
            <SelectItem value="high">🟠 Alta</SelectItem>
            <SelectItem value="medium">🟡 Média</SelectItem>
            <SelectItem value="low">🟢 Baixa</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Number input
    if (selectedField?.type === 'number') {
      return (
        <Input
          type="number"
          className="flex-1"
          placeholder="Valor"
          value={condition.value}
          onChange={(e) => onUpdate(index, { value: e.target.value })}
        />
      );
    }

    // Default text input
    return (
      <Input
        className="flex-1"
        placeholder="Valor"
        value={condition.value}
        onChange={(e) => onUpdate(index, { value: e.target.value })}
      />
    );
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
      <Select
        value={condition.field}
        onValueChange={(v) => onUpdate(index, { field: v, value: '' })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Campo" />
        </SelectTrigger>
        <SelectContent>
          {conditionFields.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(v) => onUpdate(index, { operator: v })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatorOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {renderValueInput()}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        className="shrink-0"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};
