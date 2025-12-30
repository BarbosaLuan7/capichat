import { useState, useEffect, useRef, lazy, Suspense, memo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLeads, useUpdateLeadStage, useDeleteLead } from '@/hooks/useLeads';
import { useLabels } from '@/hooks/useLabels';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { FunnelScrollIndicators } from '@/components/funnel/FunnelScrollIndicators';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Lazy load heavy modal
const LeadModal = lazy(() => import('@/components/leads/LeadModal').then(m => ({ default: m.LeadModal })));

type Lead = Database['public']['Tables']['leads']['Row'] & {
  funnel_stages: { id: string; name: string; color: string } | null;
};

type FunnelStage = Database['public']['Tables']['funnel_stages']['Row'];

interface LeadCardProps {
  lead: Lead;
  labels: Database['public']['Tables']['labels']['Row'][];
  leadLabels: { lead_id: string; label_id: string }[];
  isDragging?: boolean;
  onEdit?: (leadId: string) => void;
  onDelete?: (leadId: string) => void;
  onOpenConversation?: (leadId: string) => void;
}

const LeadCardComponent = ({ lead, labels, leadLabels, isDragging, onEdit, onDelete, onOpenConversation }: LeadCardProps) => {
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
      role="article"
      aria-label={`Lead ${lead.name}${lead.estimated_value ? `, valor estimado R$ ${Number(lead.estimated_value).toLocaleString('pt-BR')}` : ''}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={(lead as any).avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`} />
          <AvatarFallback>{lead.name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-foreground truncate">{lead.name}</h4>
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 -mr-2" 
                        aria-label={`Mais opções para ${lead.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Opções</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit?.(lead.id)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar Lead
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete?.(lead.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      aria-label={`Abrir conversa com ${lead.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenConversation?.(lead.id);
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Abrir conversa</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Memoize LeadCard to prevent re-renders during drag-and-drop
const LeadCard = memo(LeadCardComponent, (prev, next) =>
  prev.lead.id === next.lead.id &&
  prev.lead.updated_at === next.lead.updated_at &&
  prev.lead.stage_id === next.lead.stage_id &&
  prev.isDragging === next.isDragging &&
  prev.leadLabels === next.leadLabels
);
LeadCard.displayName = 'LeadCard';

interface SortableLeadCardProps {
  lead: Lead;
  labels: Database['public']['Tables']['labels']['Row'][];
  leadLabels: { lead_id: string; label_id: string }[];
  onEdit?: (leadId: string) => void;
  onDelete?: (leadId: string) => void;
  onOpenConversation?: (leadId: string) => void;
}

const SortableLeadCard = ({ lead, labels, leadLabels, onEdit, onDelete, onOpenConversation }: SortableLeadCardProps) => {
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
      <LeadCard 
        lead={lead} 
        labels={labels} 
        leadLabels={leadLabels} 
        isDragging={isDragging}
        onEdit={onEdit}
        onDelete={onDelete}
        onOpenConversation={onOpenConversation}
      />
    </div>
  );
};

interface FunnelColumnProps {
  stage: FunnelStage;
  leads: Lead[];
  labels: Database['public']['Tables']['labels']['Row'][];
  leadLabels: { lead_id: string; label_id: string }[];
  onEditLead?: (leadId: string) => void;
  onDeleteLead?: (leadId: string) => void;
  onOpenConversation?: (leadId: string) => void;
}

const FunnelColumn = ({ stage, leads, labels, leadLabels, onEditLead, onDeleteLead, onOpenConversation }: FunnelColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: 'stage',
      stageId: stage.id,
    },
  });

  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0);

  return (
    <section 
      className="flex-shrink-0 w-80"
      aria-label={`Etapa ${stage.name} - ${leads.length} leads`}
      aria-roledescription="Coluna do funil"
    >
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
          <h3 className="font-semibold text-foreground">{stage.name}</h3>
          <Badge variant="secondary" className="ml-auto" aria-label={`${leads.length} leads`}>
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
                <SortableLeadCard 
                  key={lead.id} 
                  lead={lead} 
                  labels={labels} 
                  leadLabels={leadLabels}
                  onEdit={onEditLead}
                  onDelete={onDeleteLead}
                  onOpenConversation={onOpenConversation}
                />
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
    </section>
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
  const navigate = useNavigate();
  const { data: stages = [], isLoading: stagesLoading } = useFunnelStages();
  const { data: leadsResult, isLoading: leadsLoading } = useLeads();
  const { data: labelsData = [] } = useLabels();
  const updateLeadStage = useUpdateLeadStage();
  const deleteLead = useDeleteLead();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [leadLabels, setLeadLabels] = useState<{ lead_id: string; label_id: string }[]>([]);
  
  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Modal states
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadModalMode, setLeadModalMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

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

  // Extract leads array from result object safely
  const leads = (leadsResult?.leads || []) as Lead[];

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
        // Error already logged by the hook
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleEditLead = (leadId: string) => {
    setEditingLeadId(leadId);
    setLeadModalMode('edit');
    setShowLeadModal(true);
  };

  const handleDeleteLead = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setLeadToDelete(lead);
      setDeleteConfirmOpen(true);
    }
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLead.mutateAsync(leadToDelete.id);
      toast.success('Lead excluído com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir lead');
    } finally {
      setDeleteConfirmOpen(false);
      setLeadToDelete(null);
    }
  };

  const handleOpenConversation = async (leadId: string) => {
    try {
      // Buscar conversa existente do lead
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (existingConv) {
        navigate(`/inbox?conversation=${existingConv.id}`);
      } else {
        // Se não houver conversa, criar uma nova
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({ lead_id: leadId, status: 'open' })
          .select('id')
          .single();

        if (error) throw error;
        navigate(`/inbox?conversation=${newConv.id}`);
      }
    } catch (error) {
      toast.error('Erro ao abrir conversa');
    }
  };

  const handleNewLead = () => {
    setEditingLeadId(null);
    setLeadModalMode('create');
    setShowLeadModal(true);
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
        <Button 
          className="gradient-primary text-primary-foreground"
          onClick={handleNewLead}
        >
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
          <div className="relative">
            <FunnelScrollIndicators 
              containerRef={scrollContainerRef} 
              totalColumns={stages.length} 
            />
            <div 
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto pb-4 px-1"
            >
              {stages.map((stage) => {
                const stageLeads = leads.filter((l) => l.stage_id === stage.id);
                return (
                  <FunnelColumn
                    key={stage.id}
                    stage={stage}
                    leads={stageLeads}
                    labels={labelsData}
                    leadLabels={leadLabels}
                    onEditLead={handleEditLead}
                    onDeleteLead={handleDeleteLead}
                    onOpenConversation={handleOpenConversation}
                  />
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {activeLead && (
              <LeadCard lead={activeLead} labels={labelsData} leadLabels={leadLabels} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Lead Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {showLeadModal && (
          <LeadModal
            open={showLeadModal}
            onOpenChange={setShowLeadModal}
            leadId={editingLeadId}
            mode={leadModalMode}
          />
        )}
      </Suspense>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead "{leadToDelete?.name}" será permanentemente removido do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLead}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Funnel;
