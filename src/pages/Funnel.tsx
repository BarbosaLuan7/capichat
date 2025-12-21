import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  MoreVertical,
  MessageSquare,
  Tag,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/appStore';
import { mockLabels } from '@/data/mockData';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LeadCard = ({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) => {
  const labels = mockLabels.filter((l) => lead.labelIds.includes(l.id));

  return (
    <Card
      className={cn(
        'p-4 cursor-grab active:cursor-grabbing transition-all',
        isDragging ? 'shadow-lg rotate-2 scale-105 opacity-90' : 'hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`} />
          <AvatarFallback>{lead.name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-foreground truncate">{lead.name}</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" />
              <span className="truncate">{lead.phone}</span>
            </div>
            {lead.estimatedValue && (
              <div className="flex items-center gap-2 text-success font-medium">
                <DollarSign className="w-3.5 h-3.5" />
                <span>R$ {lead.estimatedValue.toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                lead.temperature === 'hot' && 'border-destructive text-destructive',
                lead.temperature === 'warm' && 'border-warning text-warning',
                lead.temperature === 'cold' && 'border-primary text-primary'
              )}
            >
              {lead.temperature === 'hot' ? '🔥' : lead.temperature === 'warm' ? '🌡️' : '❄️'}
            </Badge>
            {labels.slice(0, 2).map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="text-xs"
                style={{ backgroundColor: `${label.color}20`, color: label.color }}
              >
                {label.name}
              </Badge>
            ))}
            {labels.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{labels.length - 2}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <span>{format(lead.createdAt, "dd/MM", { locale: ptBR })}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MessageSquare className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const SortableLeadCard = ({ lead }: { lead: Lead }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} isDragging={isDragging} />
    </div>
  );
};

const FunnelColumn = ({
  stage,
  leads,
  color,
}: {
  stage: { id: string; name: string; color: string };
  leads: Lead[];
  color: string;
}) => {
  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);

  return (
    <div className="flex-shrink-0 w-80">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-foreground">{stage.name}</h3>
          <Badge variant="secondary" className="ml-auto">
            {leads.length}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Total: R$ {(totalValue / 1000).toFixed(0)}k</span>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-16rem)]">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 pr-2">
            {leads.map((lead) => (
              <SortableLeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </SortableContext>

        {leads.length === 0 && (
          <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <p className="text-sm">Nenhum lead nesta etapa</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

const Funnel = () => {
  const { leads, funnelStages, updateLeadStage } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a stage
    const stage = funnelStages.find((s) => s.id === overId);
    if (stage) {
      updateLeadStage(leadId, stage.id);
    }
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funil de Vendas</h1>
          <p className="text-muted-foreground">Arraste os leads entre as etapas</p>
        </div>
        <Button className="gradient-primary text-primary-foreground">
          Novo Lead
        </Button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {funnelStages.slice(0, 6).map((stage) => {
            const stageLeads = leads.filter((l) => l.stageId === stage.id);
            return (
              <FunnelColumn
                key={stage.id}
                stage={stage}
                leads={stageLeads}
                color={stage.color}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default Funnel;
