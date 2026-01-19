import { useState, useMemo, lazy, Suspense } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Zap,
  Play,
  Pause,
  MoreVertical,
  Clock,
  ArrowRight,
  Bell,
  UserPlus,
  Tag,
  MessageSquare,
  CheckSquare,
  Thermometer,
  Loader2,
  Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation, useToggleAutomation } from '@/hooks/useAutomations';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Lazy load heavy modal
const AutomationModal = lazy(() => import('@/components/automations/AutomationModal').then(m => ({ default: m.AutomationModal })));
import { AutomationExecutionLogs } from '@/components/automations/AutomationExecutionLogs';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AutomationTrigger = Database['public']['Enums']['automation_trigger'];
type AutomationAction = Database['public']['Enums']['automation_action'];

interface AutomationActionConfig {
  type: AutomationAction;
  params: Record<string, string>;
}

interface AutomationCondition {
  field: string;
  operator: string;
  value: string;
}

type AutomationRow = Database['public']['Tables']['automations']['Row'];

const getTriggerLabel = (trigger: AutomationTrigger): string => {
  const labels: Record<AutomationTrigger, string> = {
    lead_created: 'Novo lead criado',
    lead_stage_changed: 'Lead mudou de etapa',
    lead_temperature_changed: 'Temperatura alterada',
    lead_no_response: 'Lead sem resposta',
    lead_label_added: 'Etiqueta adicionada',
    task_overdue: 'Tarefa vencida',
    conversation_no_response: 'Conversa sem resposta',
  };
  return labels[trigger];
};

const getActionIcon = (action: AutomationAction) => {
  const icons: Record<AutomationAction, React.ComponentType<{ className?: string }>> = {
    move_lead_to_stage: ArrowRight,
    change_lead_temperature: Thermometer,
    add_label: Tag,
    remove_label: Tag,
    create_task: CheckSquare,
    notify_user: Bell,
    assign_to_user: UserPlus,
    send_message: MessageSquare,
  };
  return icons[action];
};

const getActionLabel = (action: AutomationAction): string => {
  const labels: Record<AutomationAction, string> = {
    move_lead_to_stage: 'Mover lead',
    change_lead_temperature: 'Alterar temperatura',
    add_label: 'Adicionar etiqueta',
    remove_label: 'Remover etiqueta',
    create_task: 'Criar tarefa',
    notify_user: 'Notificar',
    assign_to_user: 'Atribuir',
    send_message: 'Enviar mensagem',
  };
  return labels[action];
};

const AutomationSkeleton = () => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const parseActions = (actions: unknown): AutomationActionConfig[] => {
  if (Array.isArray(actions)) {
    return actions as AutomationActionConfig[];
  }
  return [];
};

const parseConditions = (conditions: unknown): AutomationCondition[] => {
  if (Array.isArray(conditions)) {
    return conditions as AutomationCondition[];
  }
  return [];
};

const Automations = () => {
  const { data: automations = [], isLoading, error } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const toggleAutomation = useToggleAutomation();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<AutomationRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [automationToDelete, setAutomationToDelete] = useState<AutomationRow | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredAutomations = useMemo(() => automations.filter((auto) =>
    auto.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
    auto.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  ), [automations, debouncedSearchQuery]);

  const activeCount = automations.filter((a) => a.is_active).length;

  const handleNewAutomation = () => {
    setSelectedAutomation(null);
    setModalOpen(true);
  };

  const handleEditAutomation = (automation: AutomationRow) => {
    setSelectedAutomation(automation);
    setModalOpen(true);
  };

  const handleDeleteClick = (automation: AutomationRow) => {
    setAutomationToDelete(automation);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (automationToDelete) {
      try {
        await deleteAutomation.mutateAsync(automationToDelete.id);
        toast.success('Automação excluída', {
          description: 'A automação foi removida com sucesso.',
        });
      } catch {
        toast.error('Erro ao excluir', {
          description: 'Não foi possível excluir a automação.',
        });
      }
    }
    setDeleteDialogOpen(false);
    setAutomationToDelete(null);
  };

  const handleSaveAutomation = async (automationData: {
    id?: string;
    name: string;
    description?: string;
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    actions: AutomationActionConfig[];
    is_active: boolean;
  }) => {
    try {
      if (automationData.id) {
        await updateAutomation.mutateAsync({
          id: automationData.id,
          name: automationData.name,
          description: automationData.description,
          trigger: automationData.trigger,
          conditions: automationData.conditions as unknown as Database['public']['Tables']['automations']['Update']['conditions'],
          actions: automationData.actions as unknown as Database['public']['Tables']['automations']['Update']['actions'],
          is_active: automationData.is_active,
        });
        toast.success('Automação atualizada', {
          description: 'As alterações foram salvas.',
        });
      } else {
        await createAutomation.mutateAsync({
          name: automationData.name,
          description: automationData.description,
          trigger: automationData.trigger,
          conditions: automationData.conditions as unknown as Database['public']['Tables']['automations']['Insert']['conditions'],
          actions: automationData.actions as unknown as Database['public']['Tables']['automations']['Insert']['actions'],
          is_active: automationData.is_active,
        });
        toast.success('Automação criada', {
          description: 'Nova automação adicionada com sucesso.',
        });
      }
      setModalOpen(false);
    } catch {
      toast.error('Erro ao salvar', {
        description: 'Não foi possível salvar a automação.',
      });
    }
  };

  const handleToggleStatus = async (automation: AutomationRow) => {
    try {
      await toggleAutomation.mutateAsync({ id: automation.id, isActive: !automation.is_active });
      toast.success(automation.is_active ? 'Automação desativada' : 'Automação ativada', {
        description: automation.is_active
          ? 'A automação foi pausada.'
          : 'A automação está ativa agora.',
      });
    } catch {
      toast.error('Erro ao alterar status', {
        description: 'Não foi possível alterar o status da automação.',
      });
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Erro ao carregar automações</h3>
            <p className="text-muted-foreground">
              Ocorreu um erro ao carregar as automações. Tente novamente.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32 inline-block" />
            ) : (
              <>{automations.length} automações · {activeCount} ativas</>
            )}
          </p>
        </div>
        <Button 
          onClick={handleNewAutomation} 
          className="gradient-primary text-primary-foreground gap-2"
          disabled={createAutomation.isPending}
        >
          {createAutomation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Nova Automação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{automations.length}</p>
              )}
              <p className="text-sm text-muted-foreground">Total de automações</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <Play className="w-6 h-6 text-success" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              )}
              <p className="text-sm text-muted-foreground">Automações ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Pause className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{automations.length - activeCount}</p>
              )}
              <p className="text-sm text-muted-foreground">Automações pausadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar automações..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs for Automations and Logs */}
      <Tabs defaultValue="automations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="w-4 h-4" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Activity className="w-4 h-4" />
            Execuções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="space-y-4">
        {isLoading ? (
          <>
            <AutomationSkeleton />
            <AutomationSkeleton />
            <AutomationSkeleton />
          </>
        ) : filteredAutomations.length > 0 ? (
          filteredAutomations.map((automation, index) => {
            const actions = parseActions(automation.actions);
            const conditions = parseConditions(automation.conditions);
            
            return (
              <motion.div
                key={automation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={cn(
                  'hover:shadow-md transition-all',
                  !automation.is_active && 'opacity-60'
                )}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        automation.is_active ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <Zap className={cn(
                          'w-5 h-5',
                          automation.is_active ? 'text-primary' : 'text-muted-foreground'
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{automation.name}</h3>
                            {automation.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {automation.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={automation.is_active}
                              onCheckedChange={() => handleToggleStatus(automation)}
                              disabled={toggleAutomation.isPending}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mais opções</TooltipContent>
                                </Tooltip>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditAutomation(automation)}>
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(automation)}
                                  className="text-destructive"
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {getTriggerLabel(automation.trigger)}
                          </Badge>

                          {conditions.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {conditions.length} condição(ões)
                            </Badge>
                          )}

                          <div className="flex items-center gap-1">
                            {actions.slice(0, 3).map((action, i) => {
                              const Icon = getActionIcon(action.type);
                              return (
                                <Badge key={i} variant="secondary" className="text-xs gap-1">
                                  <Icon className="w-3 h-3" />
                                  {getActionLabel(action.type)}
                                </Badge>
                              );
                            })}
                            {actions.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{actions.length - 3}
                              </Badge>
                            )}
                          </div>

                          <span className="text-xs text-muted-foreground ml-auto">
                            Atualizado em {format(new Date(automation.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Nenhuma automação encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Tente buscar por outro termo' : 'Crie sua primeira automação para automatizar processos'}
              </p>
              <Button onClick={handleNewAutomation} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Criar Automação
              </Button>
            </div>
          </Card>
        )}
        </TabsContent>

        <TabsContent value="logs">
          <AutomationExecutionLogs />
        </TabsContent>
      </Tabs>

      {/* Automation Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {modalOpen && (
          <AutomationModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            automation={selectedAutomation}
            onSave={handleSaveAutomation}
            onDelete={async (id) => {
              try {
                await deleteAutomation.mutateAsync(id);
                toast.success('Automação excluída', {
                  description: 'A automação foi removida com sucesso.',
                });
                setModalOpen(false);
              } catch {
                toast.error('Erro ao excluir', {
                  description: 'Não foi possível excluir a automação.',
                });
              }
            }}
            isSaving={createAutomation.isPending || updateAutomation.isPending}
          />
        )}
      </Suspense>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A automação "{automationToDelete?.name}" será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAutomation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={deleteAutomation.isPending}
            >
              {deleteAutomation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Automations;
