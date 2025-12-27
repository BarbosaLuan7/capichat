import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Phone,
  DollarSign,
  MoreVertical,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLeads, useUpdateLeadStage } from '@/hooks/useLeads';
import { useLabels } from '@/hooks/useLabels';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'] & {
  funnel_stages: { id: string; name: string; color: string } | null;
};

type FunnelStage = Database['public']['Tables']['funnel_stages']['Row'];

interface LeadCardProps {
  lead: Lead;
  labels: Database['public']['Tables']['labels']['Row'][];
  leadLabels: { lead_id: string; label_id: string }[];
  isDragging?: boolean;
}

const LeadCard = ({ lead, labels, leadLabels, isDragging }: LeadCardProps) => {
  // Get labels for this lead
  const leadLabelIds = leadLabels
    .filter((ll) => ll.lead_id === lead.id)
    .map((ll) => ll.label_id);
  const leadLabelsData = labels.filter((l) => leadLabelIds.includes(l.id));

  return (
    <Card
      className={cn(
        'p-4 cursor-grab active:cursor-grabbing transition-all',
        isDragging ? 'shadow-lg rotate-2 scale-105 opacity-90' : 'hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={(lead as any).avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`} />
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
            {lead.estimated_value && (
              <div className="flex items-center gap-2 text-success font-medium">
                <DollarSign className="w-3.5 h-3.5" />
                <span>R$ {Number(lead.estimated_value).toLocaleString('pt-BR')}</span>
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
            {leadLabelsData.slice(0, 2).map((label) => (
              <Badge
                key={label.id}
                className="text-xs border-0"
                style={{ backgroundColor: label.color, color: 'white' }}
              >
                {label.name}
              </Badge>
            ))}
            {leadLabelsData.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{leadLabelsData.length - 2}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <span>{format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}</span>
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

interface SortableLeadCardProps {
  lead: Lead;
  labels: Database['public']['Tables']['labels']['Row'][];
  leadLabels: { lead_id: string; label_id: string }[];
}

const SortableLeadCard = ({ lead, labels, leadLabels }: SortableLeadCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      stageId: lead.stage_id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} labels={labels} leadLabels={leadLabels} isDragging={isDragging} />
    </div>
  );
};

interface FunnelColumnProps {
  stage: FunnelStage;
  leads: Lead[];
  labels: Database['public']['Tables']['labels']['Row'][];
  leadLabels: { lead_id: string; label_id: string }[];
}

const FunnelColumn = ({ stage, leads, labels, leadLabels }: FunnelColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: 'stage',
      stageId: stage.id,
    },
  });

  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0);

  return (
    <div className="flex-shrink-0 w-80">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="font-semibold text-foreground">{stage.name}</h3>
          <Badge variant="secondary" className="ml-auto">
            {leads.length}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Total: R$ {(totalValue / 1000).toFixed(0)}k</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[calc(100vh-16rem)] rounded-lg transition-all duration-200",
          isOver && "bg-primary/10 ring-2 ring-primary/30 ring-offset-2"
        )}
      >
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 pr-2">
              {leads.map((lead) => (
                <SortableLeadCard key={lead.id} lead={lead} labels={labels} leadLabels={leadLabels} />
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
    </div>
  );
};

const FunnelSkeleton = () => (
  <div className="flex gap-4 overflow-x-auto pb-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex-shrink-0 w-80">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const Funnel = () => {
  const { data: stages = [], isLoading: stagesLoading } = useFunnelStages();
  const { data: leadsData = [], isLoading: leadsLoading } = useLeads();
  const { data: labelsData = [] } = useLabels();
  const updateLeadStage = useUpdateLeadStage();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [leadLabels, setLeadLabels] = useState<{ lead_id: string; label_id: string }[]>([]);

  // Fetch lead_labels from database
  useEffect(() => {
    const fetchLeadLabels = async () => {
      const { data, error } = await supabase
        .from('lead_labels')
        .select('lead_id, label_id');
      
      if (!error && data) {
        setLeadLabels(data);
      }
    };
    fetchLeadLabels();
  }, []);

  // Cast leads to correct type
  const leads = leadsData as Lead[];

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Find the lead being dragged
    const draggedLead = leads.find((l) => l.id === leadId);
    if (!draggedLead) return;

    let targetStageId: string | null = null;

    // Check if dropped directly on a stage column
    if (overId.startsWith('stage-')) {
      targetStageId = overId.replace('stage-', '');
    } else {
      // Dropped on another lead - find which stage that lead is in
      const targetLead = leads.find((l) => l.id === overId);
      if (targetLead && targetLead.stage_id) {
        targetStageId = targetLead.stage_id;
      }
    }

    // If we have a target stage and it's different from current
    if (targetStageId && targetStageId !== draggedLead.stage_id) {
      setIsUpdating(true);
      try {
        await updateLeadStage.mutateAsync({ leadId, stageId: targetStageId });
        const targetStage = stages.find((s) => s.id === targetStageId);
        toast.success(`Lead movido para "${targetStage?.name}"`);
      } catch (error) {
        toast.error('Erro ao mover lead');
        console.error('Error updating lead stage:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const isLoading = stagesLoading || leadsLoading;

  return (
    <div className="p-6">
      <PageBreadcrumb items={[{ label: 'Funil de Vendas' }]} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funil de Vendas</h1>
          <p className="text-muted-foreground">
            Arraste os leads entre as etapas
            {isUpdating && (
              <span className="ml-2 inline-flex items-center gap-1 text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Salvando...
              </span>
            )}
          </p>
        </div>
        <Button className="gradient-primary text-primary-foreground">
          Novo Lead
        </Button>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <FunnelSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageLeads = leads.filter((l) => l.stage_id === stage.id);
              return (
                <FunnelColumn
                  key={stage.id}
                  stage={stage}
                  leads={stageLeads}
                  labels={labelsData}
                  leadLabels={leadLabels}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeLead && (
              <LeadCard lead={activeLead} labels={labelsData} leadLabels={leadLabels} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default Funnel;
