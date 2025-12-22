import { useState } from 'react';
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
import { Search, UserPlus } from 'lucide-react';
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
  const { data: profiles, isLoading } = useProfiles();

  const filteredProfiles = profiles?.filter(
    (p) =>
      p.id !== currentAssignee &&
      p.is_active &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()))
  ) || [];

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
            ) : filteredProfiles.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum usuário encontrado
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
