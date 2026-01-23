import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Search,
  UserPlus,
  UsersRound,
  AlertCircle,
  Users,
  User,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';
import { useTeams, TeamWithRelations } from '@/hooks/useTeams';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface TransferLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (userId: string) => void;
  currentAssignee?: string;
}

type TabType = 'users' | 'teams';

export function TransferLeadModal({
  open,
  onOpenChange,
  onTransfer,
  currentAssignee,
}: TransferLeadModalProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [selectedTeam, setSelectedTeam] = useState<TeamWithRelations | null>(null);
  const debouncedSearch = useDebounce(search, 200);
  const navigate = useNavigate();

  const { data: profiles, isLoading: isLoadingProfiles } = useProfiles();
  const { data: teams, isLoading: isLoadingTeams } = useTeams();

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearch('');
      setActiveTab('users');
      setSelectedTeam(null);
    }
    onOpenChange(newOpen);
  };

  // All active users except current assignee
  const availableProfiles = useMemo(
    () => profiles?.filter((p) => p.id !== currentAssignee && p.is_active) || [],
    [profiles, currentAssignee]
  );

  // Filtered profiles by search
  const filteredProfiles = useMemo(
    () =>
      availableProfiles.filter(
        (p) =>
          p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.email.toLowerCase().includes(debouncedSearch.toLowerCase())
      ),
    [availableProfiles, debouncedSearch]
  );

  // Filtered teams by search
  const filteredTeams = useMemo(
    () => teams?.filter((t) => t.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || [],
    [teams, debouncedSearch]
  );

  // Team members excluding current assignee
  const teamMembers = useMemo(() => {
    if (!selectedTeam?.team_members) return [];
    return selectedTeam.team_members.filter((m) => m.user_id !== currentAssignee);
  }, [selectedTeam, currentAssignee]);

  const handleTransfer = (userId: string) => {
    onTransfer(userId);
    handleOpenChange(false);
  };

  const handleBackFromTeam = () => {
    setSelectedTeam(null);
    setSearch('');
  };

  const isLoading = activeTab === 'users' ? isLoadingProfiles : isLoadingTeams;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedTeam ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleBackFromTeam}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Building2 className="h-5 w-5" />
                {selectedTeam.name}
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Transferir Lead
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tab buttons - only show when not viewing a team */}
          {!selectedTeam && (
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'users' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  setActiveTab('users');
                  setSearch('');
                }}
              >
                <User className="h-4 w-4" />
                Usuários
              </Button>
              <Button
                variant={activeTab === 'teams' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  setActiveTab('teams');
                  setSearch('');
                }}
              >
                <Users className="h-4 w-4" />
                Equipes
              </Button>
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                selectedTeam
                  ? 'Buscar membro...'
                  : activeTab === 'users'
                    ? 'Buscar usuário...'
                    : 'Buscar equipe...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="max-h-64">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Carregando...</div>
            ) : selectedTeam ? (
              // Show team members
              teamMembers.length === 0 ? (
                <div className="space-y-2 p-4 text-center">
                  <UsersRound className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum membro disponível nesta equipe</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teamMembers
                    .filter(
                      (m) =>
                        m.user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                        m.user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
                    )
                    .map((member) => (
                      <Button
                        key={member.user_id}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 py-3"
                        onClick={() => handleTransfer(member.user_id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={
                              member.user.avatar ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user.name}`
                            }
                          />
                          <AvatarFallback>{member.user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="font-medium text-foreground">
                            {member.user.name}
                            {member.is_supervisor && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (Supervisor)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                      </Button>
                    ))}
                </div>
              )
            ) : activeTab === 'users' ? (
              // Users tab content
              availableProfiles.length === 0 ? (
                <div className="space-y-3 p-6 text-center">
                  <UsersRound className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Nenhum usuário disponível</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Não há outros usuários ativos para transferir este lead.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleOpenChange(false);
                      navigate('/settings/users');
                    }}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Cadastrar usuário
                  </Button>
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="space-y-2 p-4 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum usuário encontrado para "{search}"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProfiles.map((profile) => (
                    <Button
                      key={profile.id}
                      variant="ghost"
                      className="h-auto w-full justify-start gap-3 py-3"
                      onClick={() => handleTransfer(profile.id)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={
                            profile.avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`
                          }
                        />
                        <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              )
            ) : // Teams tab content
            !teams || teams.length === 0 ? (
              <div className="space-y-3 p-6 text-center">
                <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Nenhuma equipe cadastrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crie equipes para organizar seus atendentes.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleOpenChange(false);
                    navigate('/settings/teams');
                  }}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  Criar equipe
                </Button>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="space-y-2 p-4 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma equipe encontrada para "{search}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTeams.map((team) => (
                  <Button
                    key={team.id}
                    variant="ghost"
                    className="h-auto w-full justify-start gap-3 py-3"
                    onClick={() => setSelectedTeam(team)}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        'bg-primary/10 text-primary'
                      )}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.team_members?.length || 0} membro(s)
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
