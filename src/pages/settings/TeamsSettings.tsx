import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, UserCheck, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useAppStore } from '@/store/appStore';
import { Team } from '@/types';
import { TeamModal } from '@/components/teams/TeamModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';

const TeamsSettings = () => {
  const { teams, users, leads, addTeam, updateTeam, deleteTeam } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const { toast } = useToast();

  const getUserById = (id: string) => users.find(u => u.id === id);

  const getTeamLeadsCount = (teamId: string) => {
    const memberIds = teams.find(t => t.id === teamId)?.memberIds || [];
    return leads.filter(l => memberIds.includes(l.assignedTo)).length;
  };

  const handleSave = (teamData: Omit<Team, 'id' | 'createdAt'> & { id?: string }) => {
    if (teamData.id) {
      updateTeam(teamData.id, teamData);
      toast({ title: 'Equipe atualizada com sucesso!' });
    } else {
      addTeam(teamData);
      toast({ title: 'Equipe criada com sucesso!' });
    }
  };

  const confirmDelete = (team: Team) => {
    setTeamToDelete(team);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (teamToDelete) {
      deleteTeam(teamToDelete.id);
      toast({ title: 'Equipe excluída', variant: 'destructive' });
      setDeleteDialogOpen(false);
      setTeamToDelete(null);
    }
  };

  const openEditModal = (team: Team) => {
    setSelectedTeam(team);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedTeam(null);
    setModalOpen(true);
  };

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
          const supervisor = getUserById(team.supervisorId);
          const members = team.memberIds.map(id => getUserById(id)).filter(Boolean);
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
                            key={member!.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted text-sm"
                          >
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={member!.avatar} />
                              <AvatarFallback className="text-xs">{member!.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-foreground">{member!.name.split(' ')[0]}</span>
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
        team={selectedTeam}
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
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamsSettings;
