import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, MoreVertical, Loader2, Star, Phone, Shuffle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { 
  useTeams, 
  useCreateTeam, 
  useUpdateTeam, 
  useDeleteTeam, 
  useUpdateTeamMembers,
  useUpdateTeamWhatsAppConfigs,
  type TeamWithRelations 
} from '@/hooks/useTeams';
import { useTenant } from '@/contexts/TenantContext';
import { useLeads } from '@/hooks/useLeads';
import { TeamModal } from '@/components/teams/TeamModal';
import { TeamDetailsView } from '@/components/teams/TeamDetailsView';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';

const TeamsSettings = () => {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: leadsData } = useLeads();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const updateTeamMembers = useUpdateTeamMembers();
  const updateWhatsAppConfigs = useUpdateTeamWhatsAppConfigs();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithRelations | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const leads = leadsData?.leads || [];

  const getTeamLeadsCount = (teamId: string) => {
    const team = teams?.find(t => t.id === teamId);
    if (!team) return 0;
    const memberIds = team.team_members?.map(m => m.user_id) || [];
    return leads.filter(l => l.assigned_to && memberIds.includes(l.assigned_to)).length;
  };

  const handleSave = async (data: {
    id?: string;
    name: string;
    isDefault: boolean;
    accessLevel: 'all' | 'team' | 'attendant';
    autoDistribution: boolean;
    whatsappConfigIds: string[];
    members: { userId: string; isSupervisor: boolean }[];
  }) => {
    setIsSaving(true);
    try {
      let teamId: string;

      const teamData = {
        name: data.name,
        is_default: data.isDefault,
        access_level: data.accessLevel,
        auto_distribution: data.autoDistribution,
        tenant_id: currentTenant?.id || null,
      };

      if (data.id) {
        await updateTeam.mutateAsync({ id: data.id, ...teamData });
        teamId = data.id;
      } else {
        const newTeam = await createTeam.mutateAsync(teamData);
        teamId = newTeam.id;
      }

      // Atualizar membros
      await updateTeamMembers.mutateAsync({
        teamId,
        members: data.members,
      });

      // Atualizar canais WhatsApp
      await updateWhatsAppConfigs.mutateAsync({
        teamId,
        configIds: data.whatsappConfigIds,
      });

      toast({ title: data.id ? 'Equipe atualizada!' : 'Equipe criada!' });
      setModalOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      logger.error('Erro ao salvar equipe:', error);
      toast({ title: 'Erro ao salvar equipe', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (team: TeamWithRelations) => {
    setTeamToDelete(team);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (teamToDelete) {
      try {
        await deleteTeamMutation.mutateAsync(teamToDelete.id);
        toast({ title: 'Equipe excluída' });
        setDeleteDialogOpen(false);
        setTeamToDelete(null);
        setDetailsOpen(false);
      } catch (error) {
        toast({ title: 'Erro ao excluir equipe', variant: 'destructive' });
      }
    }
  };

  const openEditModal = (team: TeamWithRelations) => {
    setSelectedTeam(team);
    setDetailsOpen(false);
    setModalOpen(true);
  };

  const openDetailsSheet = (team: TeamWithRelations) => {
    setSelectedTeam(team);
    setDetailsOpen(true);
  };

  const openCreateModal = () => {
    setSelectedTeam(null);
    setModalOpen(true);
  };

  if (teamsLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageBreadcrumb items={[{ label: 'Configurações', href: '/settings' }, { label: 'Equipes' }]} />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Configurações', href: '/settings' }, { label: 'Equipes' }]} />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipes</h1>
          <p className="text-muted-foreground">Organize sua equipe em departamentos</p>
        </div>
        <Button onClick={openCreateModal} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Nova Equipe
        </Button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams?.map((team, index) => {
          const members = team.team_members || [];
          const channels = team.team_whatsapp_configs || [];
          const leadsCount = getTeamLeadsCount(team.id);
          const supervisors = members.filter(m => m.is_supervisor);

          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => openDetailsSheet(team)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{team.name}</CardTitle>
                          {team.is_default && (
                            <Star className="w-4 h-4 text-warning fill-warning" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {members.length} membro{members.length !== 1 && 's'}
                          {supervisors.length > 0 && ` • ${supervisors.length} supervisor${supervisors.length !== 1 ? 'es' : ''}`}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mais opções</TooltipContent>
                        </Tooltip>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditModal(team); }}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); confirmDelete(team); }}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Badges de features */}
                  <div className="flex flex-wrap gap-2">
                    {channels.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Phone className="w-3 h-3" />
                        {channels.length} canal{channels.length !== 1 && 'is'}
                      </Badge>
                    )}
                    {team.auto_distribution && (
                      <Badge variant="secondary" className="gap-1">
                        <Shuffle className="w-3 h-3" />
                        Auto
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4">
                    <div className="flex-1 text-center p-3 rounded-lg bg-primary/5">
                      <p className="text-2xl font-bold text-primary">{leadsCount}</p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div className="flex-1 text-center p-3 rounded-lg bg-success/5">
                      <p className="text-2xl font-bold text-success">{members.length}</p>
                      <p className="text-xs text-muted-foreground">Atendentes</p>
                    </div>
                  </div>

                  {/* Members */}
                  {members.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Membros</p>
                      <div className="flex flex-wrap gap-2">
                        {members.slice(0, 4).map(member => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted text-sm"
                          >
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={member.user?.avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {member.user?.name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-foreground">
                              {member.user?.name?.split(' ')[0] || 'Usuário'}
                            </span>
                            {member.is_supervisor && (
                              <Star className="w-3 h-3 text-warning fill-warning" />
                            )}
                          </div>
                        ))}
                        {members.length > 4 && (
                          <Badge variant="secondary">+{members.length - 4}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {members.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum membro atribuído
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {(!teams || teams.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Nenhuma equipe criada</h3>
              <p className="text-muted-foreground mb-4">
                Crie equipes para organizar seus atendentes
              </p>
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Equipe
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de criação/edição */}
      <TeamModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        team={selectedTeam}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* Sheet de detalhes */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-[600px] p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhes da Equipe</SheetTitle>
          </SheetHeader>
          {selectedTeam && (
            <TeamDetailsView
              team={selectedTeam}
              onEdit={() => openEditModal(selectedTeam)}
              onDelete={() => confirmDelete(selectedTeam)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a equipe <span className="font-medium">{teamToDelete?.name}</span>? 
              Os membros não serão excluídos, apenas desvinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTeamMutation.isPending}
            >
              {deleteTeamMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamsSettings;
