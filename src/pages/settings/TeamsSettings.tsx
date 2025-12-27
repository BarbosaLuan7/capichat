import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, UserCheck, MoreVertical, Loader2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '@/hooks/useTeams';
import { useProfiles } from '@/hooks/useProfiles';
import { useLeads } from '@/hooks/useLeads';
import { TeamModal } from '@/components/teams/TeamModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import type { Database } from '@/integrations/supabase/types';

type DbTeam = Database['public']['Tables']['teams']['Row'] & {
  supervisor?: { id: string; name: string; email: string; avatar: string | null } | null;
};

const TeamsSettings = () => {
  const { data: teamsData, isLoading: teamsLoading } = useTeams();
  const { data: profiles } = useProfiles();
  const { data: leadsData } = useLeads();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<DbTeam | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<DbTeam | null>(null);
  const { toast } = useToast();

  const teams = (teamsData || []) as unknown as DbTeam[];
  const users = profiles || [];
  const leads = leadsData?.leads || [];

  const getUserById = (id: string) => users.find(u => u.id === id);

  // Get team members by checking profiles with team_id
  const getTeamMembers = (teamId: string) => {
    return users.filter(u => u.team_id === teamId);
  };

  const getTeamLeadsCount = (teamId: string) => {
    const members = getTeamMembers(teamId);
    const memberIds = members.map(m => m.id);
    return leads.filter(l => l.assigned_to && memberIds.includes(l.assigned_to)).length;
  };

  const handleSave = async (teamData: {
    id?: string;
    name: string;
    supervisorId: string;
    memberIds: string[];
  }) => {
    try {
      if (teamData.id) {
        await updateTeam.mutateAsync({
          id: teamData.id,
          name: teamData.name,
          supervisor_id: teamData.supervisorId || null,
        });
        toast({ title: 'Equipe atualizada com sucesso!' });
      } else {
        await createTeam.mutateAsync({
          name: teamData.name,
          supervisor_id: teamData.supervisorId || null,
        });
        toast({ title: 'Equipe criada com sucesso!' });
      }
      setModalOpen(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar equipe', variant: 'destructive' });
    }
  };

  const confirmDelete = (team: DbTeam) => {
    setTeamToDelete(team);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (teamToDelete) {
      try {
        await deleteTeamMutation.mutateAsync(teamToDelete.id);
        toast({ title: 'Equipe excluída', variant: 'destructive' });
        setDeleteDialogOpen(false);
        setTeamToDelete(null);
      } catch (error) {
        toast({ title: 'Erro ao excluir equipe', variant: 'destructive' });
      }
    }
  };

  const openEditModal = (team: DbTeam) => {
    setSelectedTeam(team);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedTeam(null);
    setModalOpen(true);
  };

  // Convert DB team to modal format
  const convertTeamForModal = (team: DbTeam | null) => {
    if (!team) return null;
    const members = getTeamMembers(team.id);
    return {
      id: team.id,
      name: team.name,
      supervisorId: team.supervisor_id || '',
      memberIds: members.map(m => m.id),
      createdAt: new Date(team.created_at),
    };
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
        {teams.map((team, index) => {
          const supervisor = team.supervisor || (team.supervisor_id ? getUserById(team.supervisor_id) : null);
          const members = getTeamMembers(team.id);
          const leadsCount = getTeamLeadsCount(team.id);

          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {members.length} membro{members.length !== 1 && 's'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
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
                        <DropdownMenuItem onClick={() => openEditModal(team)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => confirmDelete(team)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Supervisor */}
                  {supervisor && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Supervisor:</span>
                      <span className="text-sm font-medium text-foreground">{supervisor.name}</span>
                    </div>
                  )}

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
                              <AvatarImage src={member.avatar || undefined} />
                              <AvatarFallback className="text-xs">{member.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-foreground">{member.name.split(' ')[0]}</span>
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

        {teams.length === 0 && (
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

      <TeamModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        team={convertTeamForModal(selectedTeam)}
        onSave={handleSave}
        onDelete={(teamId) => {
          const team = teams.find(t => t.id === teamId);
          if (team) confirmDelete(team);
        }}
      />

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
