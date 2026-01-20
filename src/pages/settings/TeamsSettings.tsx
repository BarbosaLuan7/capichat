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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useUpdateTeamMembers,
  useUpdateTeamWhatsAppConfigs,
  type TeamWithRelations,
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

  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithRelations | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const leads = leadsData?.leads || [];

  const getTeamLeadsCount = (teamId: string) => {
    const team = teams?.find((t) => t.id === teamId);
    if (!team) return 0;
    const memberIds = team.team_members?.map((m) => m.user_id) || [];
    return leads.filter((l) => l.assigned_to && memberIds.includes(l.assigned_to)).length;
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

      toast.success(data.id ? 'Equipe atualizada!' : 'Equipe criada!');
      setModalOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      logger.error('Erro ao salvar equipe:', error);
      toast.error('Erro ao salvar equipe');
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
        toast.success('Equipe excluída');
        setDeleteDialogOpen(false);
        setTeamToDelete(null);
        setDetailsOpen(false);
      } catch (error) {
        toast.error('Erro ao excluir equipe');
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
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          items={[{ label: 'Configurações', href: '/settings' }, { label: 'Equipes' }]}
        />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        items={[{ label: 'Configurações', href: '/settings' }, { label: 'Equipes' }]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipes</h1>
          <p className="text-muted-foreground">Organize sua equipe em departamentos</p>
        </div>
        <Button
          onClick={openCreateModal}
          className="gradient-primary gap-2 text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Nova Equipe
        </Button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {teams?.map((team, index) => {
          const members = team.team_members || [];
          const channels = team.team_whatsapp_configs || [];
          const leadsCount = getTeamLeadsCount(team.id);
          const supervisors = members.filter((m) => m.is_supervisor);

          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => openDetailsSheet(team)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="gradient-primary flex h-12 w-12 items-center justify-center rounded-lg">
                        <Users className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{team.name}</CardTitle>
                          {team.is_default && (
                            <Star className="h-4 w-4 fill-warning text-warning" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {members.length} membro{members.length !== 1 && 's'}
                          {supervisors.length > 0 &&
                            ` • ${supervisors.length} supervisor${supervisors.length !== 1 ? 'es' : ''}`}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mais opções</TooltipContent>
                        </Tooltip>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(team);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(team);
                          }}
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
                        <Phone className="h-3 w-3" />
                        {channels.length} canal{channels.length !== 1 && 'is'}
                      </Badge>
                    )}
                    {team.auto_distribution && (
                      <Badge variant="secondary" className="gap-1">
                        <Shuffle className="h-3 w-3" />
                        Auto
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4">
                    <div className="flex-1 rounded-lg bg-primary/5 p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{leadsCount}</p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div className="flex-1 rounded-lg bg-success/5 p-3 text-center">
                      <p className="text-2xl font-bold text-success">{members.length}</p>
                      <p className="text-xs text-muted-foreground">Atendentes</p>
                    </div>
                  </div>

                  {/* Members */}
                  {members.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-foreground">Membros</p>
                      <div className="flex flex-wrap gap-2">
                        {members.slice(0, 4).map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-sm"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member.user?.avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {member.user?.name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-foreground">
                              {member.user?.name?.split(' ')[0] || 'Usuário'}
                            </span>
                            {member.is_supervisor && (
                              <Star className="h-3 w-3 fill-warning text-warning" />
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
                    <p className="py-4 text-center text-sm text-muted-foreground">
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
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-semibold text-foreground">Nenhuma equipe criada</h3>
              <p className="mb-4 text-muted-foreground">
                Crie equipes para organizar seus atendentes
              </p>
              <Button onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
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
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[600px]">
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
              Tem certeza que deseja excluir a equipe{' '}
              <span className="font-medium">{teamToDelete?.name}</span>? Os membros não serão
              excluídos, apenas desvinculados.
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
