import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useTeams } from '@/hooks/useTeams';
import { useUpdateUserTeams, type ProfileWithRelations } from '@/hooks/useProfiles';

interface TeamSelection {
  teamId: string;
  isUser: boolean;
  isSupervisor: boolean;
}

interface UserTeamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRelations | null;
}

export const UserTeamsModal = ({ open, onOpenChange, user }: UserTeamsModalProps) => {
  const { data: teams } = useTeams();
  const updateUserTeams = useUpdateUserTeams();

  const [selections, setSelections] = useState<TeamSelection[]>([]);

  // Inicializar seleções quando o modal abrir
  useEffect(() => {
    if (open && teams && user) {
      const currentTeams = user.team_memberships || [];

      setSelections(
        teams.map((team) => {
          const membership = currentTeams.find((tm) => tm.team_id === team.id);
          return {
            teamId: team.id,
            isUser: !!membership,
            isSupervisor: membership?.is_supervisor || false,
          };
        })
      );
    }
  }, [open, teams, user]);

  const toggleUser = (teamId: string) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.teamId === teamId) {
          // Se desmarcar usuário, também desmarca supervisor
          const newIsUser = !s.isUser;
          return {
            ...s,
            isUser: newIsUser,
            isSupervisor: newIsUser ? s.isSupervisor : false,
          };
        }
        return s;
      })
    );
  };

  const toggleSupervisor = (teamId: string) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.teamId === teamId && s.isUser) {
          return { ...s, isSupervisor: !s.isSupervisor };
        }
        return s;
      })
    );
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      const teamsToSave = selections
        .filter((s) => s.isUser)
        .map((s) => ({
          teamId: s.teamId,
          isSupervisor: s.isSupervisor,
        }));

      await updateUserTeams.mutateAsync({
        userId: user.id,
        teams: teamsToSave,
      });

      toast.success('Equipes atualizadas!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const getTeamName = (teamId: string) => {
    return teams?.find((t) => t.id === teamId)?.name || '';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Equipes do usuário</SheetTitle>
          <SheetDescription>
            Defina em quais equipes o usuário faz parte e se é supervisor
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {/* Seção Usuário */}
            <div>
              <h3 className="mb-1 font-medium">Usuário</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Defina em quais equipes este usuário poderá atender aos clientes
              </p>

              <div className="space-y-2">
                {teams?.map((team) => {
                  const selection = selections.find((s) => s.teamId === team.id);
                  return (
                    <div
                      key={team.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                    >
                      <span className="text-sm font-medium">{team.name}</span>
                      <Switch
                        checked={selection?.isUser || false}
                        onCheckedChange={() => toggleUser(team.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Seção Supervisor */}
            <div>
              <h3 className="mb-1 font-medium">Supervisor</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Defina em quais equipes este usuário poderá ver todos os atendimentos e moderar as
                mensagens
              </p>

              <div className="space-y-2">
                {teams?.map((team) => {
                  const selection = selections.find((s) => s.teamId === team.id);
                  const isDisabled = !selection?.isUser;

                  return (
                    <div
                      key={team.id}
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        isDisabled ? 'bg-muted/30 opacity-50' : 'bg-muted/50'
                      }`}
                    >
                      <span className="text-sm font-medium">{team.name}</span>
                      <Switch
                        checked={selection?.isSupervisor || false}
                        onCheckedChange={() => toggleSupervisor(team.id)}
                        disabled={isDisabled}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer com ID e botões */}
        <div className="border-t p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Id: <span className="font-mono">{user?.id}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateUserTeams.isPending}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updateUserTeams.isPending}>
                {updateUserTeams.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
