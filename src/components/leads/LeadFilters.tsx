import { useState, memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Filter, Tag, Thermometer, User, CalendarDays, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface FunnelStage {
  id: string;
  name: string;
  color: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
  category: string;
}

interface Profile {
  id: string;
  name: string;
}

export interface LeadFiltersState {
  stageId: string | null;
  labelIds: string[];
  temperature: string | null;
  assignedTo: string | null;
  dateRange: DateRange | undefined;
}

interface LeadFiltersProps {
  filters: LeadFiltersState;
  onFiltersChange: (filters: LeadFiltersState) => void;
  funnelStages: FunnelStage[];
  labels: Label[];
  profiles: Profile[];
}

function LeadFiltersComponent({
  filters,
  onFiltersChange,
  funnelStages,
  labels,
  profiles,
}: LeadFiltersProps) {
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const activeFiltersCount = [
    filters.stageId,
    filters.labelIds.length > 0,
    filters.temperature,
    filters.assignedTo,
    filters.dateRange?.from,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFiltersChange({
      stageId: null,
      labelIds: [],
      temperature: null,
      assignedTo: null,
      dateRange: undefined,
    });
  };

  const toggleLabel = (labelId: string) => {
    const newLabelIds = filters.labelIds.includes(labelId)
      ? filters.labelIds.filter((id) => id !== labelId)
      : [...filters.labelIds, labelId];
    onFiltersChange({ ...filters, labelIds: newLabelIds });
  };

  const labelsByCategory = labels.reduce(
    (acc, label) => {
      if (!acc[label.category]) acc[label.category] = [];
      acc[label.category].push(label);
      return acc;
    },
    {} as Record<string, Label[]>
  );

  const categoryLabels: Record<string, string> = {
    origem: 'Origem',
    interesse: 'Interesse',
    prioridade: 'Prioridade',
    status: 'Status/Workflow',
    beneficio: 'Benefício',
    condicao_saude: 'Condição de Saúde',
    desqualificacao: 'Desqualificação',
    situacao: 'Situação',
    perda: 'Motivo de Perda',
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Etapa do Funil */}
      <Select
        value={filters.stageId || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, stageId: value === 'all' ? null : value })
        }
      >
        <SelectTrigger className="h-9 w-[180px]">
          <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as etapas</SelectItem>
          {funnelStages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                {stage.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Etiquetas (Multi-select) */}
      <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2">
            <Tag className="h-4 w-4" />
            Etiquetas
            {filters.labelIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {filters.labelIds.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="border-b p-3">
            <p className="text-sm font-medium">Filtrar por etiquetas</p>
            <p className="text-xs text-muted-foreground">Selecione uma ou mais etiquetas</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {Object.entries(labelsByCategory).map(([category, categoryLabelsItems]) => (
              <div key={category} className="mb-3">
                <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                  {categoryLabels[category] || category}
                </p>
                {categoryLabelsItems.map((label) => (
                  <div
                    key={label.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                    onClick={() => toggleLabel(label.id)}
                  >
                    <Checkbox checked={filters.labelIds.includes(label.id)} />
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm">{label.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {filters.labelIds.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => onFiltersChange({ ...filters, labelIds: [] })}
              >
                Limpar seleção
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Temperatura */}
      <Select
        value={filters.temperature || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, temperature: value === 'all' ? null : value })
        }
      >
        <SelectTrigger className="h-9 w-[140px]">
          <Thermometer className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Temperatura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="hot">🔥 Quente</SelectItem>
          <SelectItem value="warm">🌡️ Morno</SelectItem>
          <SelectItem value="cold">❄️ Frio</SelectItem>
        </SelectContent>
      </Select>

      {/* Responsável */}
      <Select
        value={filters.assignedTo || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, assignedTo: value === 'all' ? null : value })
        }
      >
        <SelectTrigger className="h-9 w-[180px]">
          <User className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {profiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              {profile.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Data de Criação (Range Picker) */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2">
            <CalendarDays className="h-4 w-4" />
            {filters.dateRange?.from ? (
              filters.dateRange.to ? (
                <>
                  {format(filters.dateRange.from, 'dd/MM', { locale: ptBR })} -{' '}
                  {format(filters.dateRange.to, 'dd/MM', { locale: ptBR })}
                </>
              ) : (
                format(filters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
              )
            ) : (
              'Data'
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={filters.dateRange}
            onSelect={(range) => {
              onFiltersChange({ ...filters, dateRange: range });
            }}
            numberOfMonths={2}
            locale={ptBR}
            className={cn('pointer-events-auto p-3')}
          />
          {filters.dateRange?.from && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => onFiltersChange({ ...filters, dateRange: undefined })}
              >
                Limpar datas
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Limpar Filtros */}
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          onClick={clearAllFilters}
        >
          <X className="h-4 w-4" />
          Limpar ({activeFiltersCount})
        </Button>
      )}
    </div>
  );
}

// Memoize para evitar re-renders desnecessários
export const LeadFilters = memo(LeadFiltersComponent);
