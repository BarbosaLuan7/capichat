import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Phone, 
  MessageSquare, 
  Link2, 
  Edit,
  Trash2,
  Star,
  Shuffle,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { TeamWithRelations } from '@/hooks/useTeams';

interface TeamDetailsViewProps {
  team: TeamWithRelations;
  onEdit: () => void;
  onDelete: () => void;
}

export function TeamDetailsView({ team, onEdit, onDelete }: TeamDetailsViewProps) {

  const accessLevelLabels = {
    all: 'Todos',
    team: 'Equipe',
    attendant: 'Atendente',
  };

  const accessLevelDescriptions = {
    all: 'Visível a todos os usuários',
    team: 'Visível apenas aos membros da equipe',
    attendant: 'Visível apenas ao atendente e supervisores',
  };

  const copyLink = (phoneNumber: string) => {
    const link = `https://wa.me/${phoneNumber.replace(/\D/g, '')}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const members = team.team_members || [];
  const channels = team.team_whatsapp_configs || [];
  const supervisors = members.filter(m => m.is_supervisor);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl gradient-primary flex items-center justify-center">
            <span className="text-xl font-bold text-primary-foreground">
              {team.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{team.name}</h2>
              {team.is_default && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="w-3 h-3" />
                  Padrão
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Id: {team.id}
            </p>
            <p className="text-xs text-muted-foreground">
              Criada em: {format(new Date(team.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-1" />
            Excluir
          </Button>
          <Button size="sm" onClick={onEdit} className="gradient-primary text-primary-foreground">
            <Edit className="w-4 h-4 mr-1" />
            Alterar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Nome */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Nome</p>
          <p className="font-medium text-foreground">{team.name}</p>
        </div>

        {/* Acesso */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Acesso aos atendimentos</p>
          <p className="font-medium text-foreground">
            {accessLevelLabels[(team.access_level as keyof typeof accessLevelLabels) || 'team']}
          </p>
          <p className="text-xs text-muted-foreground">
            {accessLevelDescriptions[(team.access_level as keyof typeof accessLevelDescriptions) || 'team']}
          </p>
        </div>
      </div>

      <Separator />

      {/* Canais Associados */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <p className="font-medium text-foreground">Canais associados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {channels.map(c => (
            <Badge key={c.id} variant="secondary" className="gap-1">
              <Phone className="w-3 h-3" />
              {c.whatsapp_config?.phone_number || c.whatsapp_config?.name || 'Canal'}
            </Badge>
          ))}
          {channels.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum canal associado</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Links de Atendimento */}
      {channels.length > 0 && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium text-foreground">Link para atendimento direto</p>
            </div>
            <div className="space-y-2">
              {channels.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {c.whatsapp_config?.phone_number || c.whatsapp_config?.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => c.whatsapp_config?.phone_number && copyLink(c.whatsapp_config.phone_number)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar link
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Distribuição */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shuffle className="w-4 h-4 text-muted-foreground" />
          <p className="font-medium text-foreground">Distribuição de atendimentos</p>
        </div>
        <Badge variant={team.auto_distribution ? 'default' : 'secondary'}>
          {team.auto_distribution ? 'Habilitado' : 'Desabilitado'}
        </Badge>
      </div>

      <Separator />

      {/* Usuários */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="font-medium text-foreground">
            Usuários ({members.length})
          </p>
          {supervisors.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {supervisors.length} supervisor{supervisors.length !== 1 ? 'es' : ''}
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.user?.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {m.user?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">{m.user?.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Usuário
                </Badge>
                {m.is_supervisor && (
                  <Badge variant="default" className="text-xs">
                    Supervisor
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum usuário na equipe
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
