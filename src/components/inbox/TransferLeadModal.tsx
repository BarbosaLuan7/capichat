import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, UserPlus, UsersRound, AlertCircle } from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';

interface TransferLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (userId: string) => void;
  currentAssignee?: string;
}

export function TransferLeadModal({
  open,
  onOpenChange,
  onTransfer,
  currentAssignee,
}: TransferLeadModalProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data: profiles, isLoading } = useProfiles();

  // All active users except current assignee
  const availableProfiles = profiles?.filter(
    (p) => p.id !== currentAssignee && p.is_active
  ) || [];

  // Filtered by search
  const filteredProfiles = availableProfiles.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = (userId: string) => {
    onTransfer(userId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Transferir Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="max-h-64">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : availableProfiles.length === 0 ? (
              // No other active users in the system
              <div className="p-6 text-center space-y-3">
                <UsersRound className="w-10 h-10 text-muted-foreground mx-auto" />
                <div>
                  <p className="font-medium text-foreground">Nenhum usuário disponível</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há outros usuários ativos para transferir este lead.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/settings/users');
                  }}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar usuário
                </Button>
              </div>
            ) : filteredProfiles.length === 0 ? (
              // Search returned no results
              <div className="p-4 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  Nenhum usuário encontrado para "{search}"
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProfiles.map((profile) => (
                  <Button
                    key={profile.id}
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => handleTransfer(profile.id)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} />
                      <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium text-foreground">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
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
