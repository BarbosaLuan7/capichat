import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lock, Unlock, Trash2, Edit, CheckCircle2, XCircle, Users } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useToggleUserBlock,
  useUpdateAvailability,
  type ProfileWithRelations,
} from '@/hooks/useProfiles';
import { getRoleLabel, getRoleColor } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRelations | null;
  userRole: AppRole;
  onEdit: () => void;
  onEditTeams: () => void;
}

export const UserDetailsSheet = ({
  open,
  onOpenChange,
  user,
  userRole,
  onEdit,
  onEditTeams,
}: UserDetailsSheetProps) => {
  const toggleBlock = useToggleUserBlock();
  const updateAvailability = useUpdateAvailability();

  if (!user) return null;

  const handleBlock = async () => {
    try {
      await toggleBlock.mutateAsync({
        id: user.id,
        isActive: !user.is_active,
      });
      toast.success(user.is_active ? 'Usuário bloqueado' : 'Usuário desbloqueado');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleToggleAvailability = async () => {
    try {
      await updateAvailability.mutateAsync({
        id: user.id,
        isAvailable: !user.is_available,
      });
      toast.success('Disponibilidade atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const teamMemberships = user.team_memberships || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhes do usuário</SheetTitle>
          <SheetDescription>Visualizar informações do usuário {user.name}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {/* Header com Avatar e Ações */}
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBlock}
                    disabled={toggleBlock.isPending}
                  >
                    {user.is_active ? (
                      <Lock className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="mr-1 h-3.5 w-3.5" />
                    )}
                    {user.is_active ? 'Bloquear' : 'Desbloquear'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                  <Button variant="default" size="sm" onClick={onEdit}>
                    <Edit className="mr-1 h-3.5 w-3.5" />
                    Alterar
                  </Button>
                </div>
              </div>
            </div>

            {/* ID e Data */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Id: <span className="font-mono">{user.id}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Data criação:{' '}
                  {format(new Date(user.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                </p>
              </div>
              <Badge className={cn(getRoleColor(userRole))}>{getRoleLabel(userRole)}</Badge>
            </div>

            <Separator />

            {/* Informações Básicas */}
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Nome</p>
                <p className="font-medium">{user.name}</p>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">E-mail</p>
                <p className="font-medium">{user.email}</p>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium">{user.phone || 'Não informado'}</p>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Apelido utilizado no atendimento
                </p>
                <p className="font-medium">{user.nickname || 'Indefinido'}</p>
              </div>
            </div>

            <Separator />

            {/* Disponibilidade */}
            <div>
              <p className="mb-3 text-sm font-medium">Disponibilidade</p>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  {user.is_available ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Disponível</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Indisponível</span>
                    </>
                  )}
                </div>
                <Switch
                  checked={user.is_available ?? true}
                  onCheckedChange={handleToggleAvailability}
                  disabled={updateAvailability.isPending}
                />
              </div>
            </div>

            <Separator />

            {/* Equipes */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Equipes</p>
                <Button variant="ghost" size="sm" onClick={onEditTeams}>
                  <Users className="mr-1 h-3.5 w-3.5" />
                  Alterar
                </Button>
              </div>

              {teamMemberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma equipe atribuída</p>
              ) : (
                <div className="space-y-2">
                  {teamMemberships.map((tm) => (
                    <div
                      key={tm.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                    >
                      <span className="text-sm font-medium">{tm.team?.name}</span>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">
                          Usuário
                        </Badge>
                        {tm.is_supervisor && (
                          <Badge variant="secondary" className="text-xs">
                            Supervisor
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
