import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Team } from '@/types';
import { useProfiles } from '@/hooks/useProfiles';

const teamSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  supervisorId: z.string().min(1, 'Supervisor obrigatório'),
  memberIds: z.array(z.string()),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
  onSave: (team: Omit<Team, 'id' | 'createdAt'> & { id?: string }) => void;
  onDelete?: (teamId: string) => void;
  isLoading?: boolean;
}

export const TeamModal = ({ open, onOpenChange, team, onSave, onDelete, isLoading = false }: TeamModalProps) => {
  const { data: profilesData } = useProfiles();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Map profiles to users format for backwards compatibility
  const users = profilesData?.map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: 'agent' as const, // Default role - roles are stored separately
    isActive: p.is_active,
    teamId: p.team_id,
  })) || [];

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      supervisorId: '',
      memberIds: [],
    },
  });

  // For TeamModal, we use profiles as list - roles are handled by parent
  const managers = users;
  const agents = users;

  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        supervisorId: team.supervisorId,
        memberIds: team.memberIds,
      });
    } else {
      form.reset({
        name: '',
        supervisorId: '',
        memberIds: [],
      });
    }
  }, [team, form]);

  const handleSubmit = (data: TeamFormData) => {
    const teamData = {
      name: data.name,
      supervisorId: data.supervisorId,
      memberIds: data.memberIds,
      ...(team?.id && { id: team.id }),
    };
    onSave(teamData);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (team && onDelete) {
      onDelete(team.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    }
  };

  const memberIds = form.watch('memberIds');

  const toggleMember = (userId: string) => {
    const current = form.getValues('memberIds');
    if (current.includes(userId)) {
      form.setValue('memberIds', current.filter(id => id !== userId));
    } else {
      form.setValue('memberIds', [...current, userId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{team ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Equipe</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Vendas, Suporte, etc" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supervisorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supervisor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar supervisor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {managers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="memberIds"
              render={() => (
                <FormItem>
                  <FormLabel>Membros</FormLabel>
                  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {agents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum atendente disponível</p>
                    ) : (
                      agents.map(user => (
                        <div key={user.id} className="flex items-center gap-3">
                          <Checkbox
                            checked={memberIds.includes(user.id)}
                            onCheckedChange={() => toggleMember(user.id)}
                          />
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-4">
              {team && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="gradient-primary text-primary-foreground" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {team ? 'Salvar' : 'Criar Equipe'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a equipe <span className="font-medium">{team?.name}</span>? 
              Os membros não serão excluídos, apenas desvinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
