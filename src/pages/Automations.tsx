import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useAppStore } from '@/store/appStore';
import { Automation, AutomationTrigger, AutomationAction } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AutomationModal } from '@/components/automations/AutomationModal';
import { toast } from '@/hooks/use-toast';

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
  const icons: Record<AutomationAction, any> = {
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

const Automations = () => {
  const { automations, addAutomation, updateAutomation, deleteAutomation, toggleAutomationStatus } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(null);

  const filteredAutomations = automations.filter((auto) =>
    auto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    auto.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = automations.filter((a) => a.isActive).length;

  const handleNewAutomation = () => {
    setSelectedAutomation(null);
    setModalOpen(true);
  };

  const handleEditAutomation = (automation: Automation) => {
    setSelectedAutomation(automation);
    setModalOpen(true);
  };

  const handleDeleteClick = (automation: Automation) => {
    setAutomationToDelete(automation);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (automationToDelete) {
      deleteAutomation(automationToDelete.id);
      toast({
        title: 'Automação excluída',
        description: 'A automação foi removida com sucesso.',
      });
    }
    setDeleteDialogOpen(false);
    setAutomationToDelete(null);
  };

  const handleSaveAutomation = (automationData: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (automationData.id) {
      updateAutomation(automationData.id, automationData);
      toast({
        title: 'Automação atualizada',
        description: 'As alterações foram salvas.',
      });
    } else {
      addAutomation(automationData);
      toast({
        title: 'Automação criada',
        description: 'Nova automação adicionada com sucesso.',
      });
    }
  };

  const handleToggleStatus = (automation: Automation) => {
    toggleAutomationStatus(automation.id);
    toast({
      title: automation.isActive ? 'Automação desativada' : 'Automação ativada',
      description: automation.isActive
        ? 'A automação foi pausada.'
        : 'A automação está ativa agora.',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">
            {automations.length} automações · {activeCount} ativas
          </p>
        </div>
        <Button onClick={handleNewAutomation} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
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
              <p className="text-2xl font-bold text-foreground">{automations.length}</p>
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
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
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
              <p className="text-2xl font-bold text-foreground">{automations.length - activeCount}</p>
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

      {/* Automations List */}
      <div className="space-y-4">
        {filteredAutomations.map((automation, index) => (
          <motion.div
            key={automation.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className={cn(
              'hover:shadow-md transition-all',
              !automation.isActive && 'opacity-60'
            )}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    automation.isActive ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <Zap className={cn(
                      'w-5 h-5',
                      automation.isActive ? 'text-primary' : 'text-muted-foreground'
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
                          checked={automation.isActive}
                          onCheckedChange={() => handleToggleStatus(automation)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
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

                      {automation.conditions.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {automation.conditions.length} condição(ões)
                        </Badge>
                      )}

                      <div className="flex items-center gap-1">
                        {automation.actions.slice(0, 3).map((action, i) => {
                          const Icon = getActionIcon(action.type);
                          return (
                            <Badge key={i} variant="secondary" className="text-xs gap-1">
                              <Icon className="w-3 h-3" />
                              {getActionLabel(action.type)}
                            </Badge>
                          );
                        })}
                        {automation.actions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{automation.actions.length - 3}
                          </Badge>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground ml-auto">
                        Atualizado em {format(automation.updatedAt, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {filteredAutomations.length === 0 && (
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
      </div>

      {/* Automation Modal */}
      <AutomationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        automation={selectedAutomation}
        onSave={handleSaveAutomation}
        onDelete={(id) => {
          deleteAutomation(id);
          toast({
            title: 'Automação excluída',
            description: 'A automação foi removida com sucesso.',
          });
        }}
      />

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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Automations;
