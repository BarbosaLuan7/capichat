import { useState } from 'react';
import { Users, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useTenantUsers, useAddUserToTenant, useUpdateUserTenant, useRemoveUserFromTenant } from '@/hooks/useTenants';
import { useProfiles } from '@/hooks/useProfiles';
import type { Tenant } from '@/contexts/TenantContext';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  agent: 'Atendente',
  viewer: 'Visualizador',
};

const roleBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  manager: 'secondary',
  agent: 'outline',
  viewer: 'outline',
};

interface TenantUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
}

export function TenantUsersModal({ open, onOpenChange, tenant }: TenantUsersModalProps) {
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('agent');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{ userId: string; name: string } | null>(null);

  const { data: tenantUsers, isLoading: loadingUsers } = useTenantUsers(tenant?.id);
  const { data: allProfiles, isLoading: loadingProfiles } = useProfiles();
  const addUserToTenant = useAddUserToTenant();
  const updateUserTenant = useUpdateUserTenant();
  const removeUserFromTenant = useRemoveUserFromTenant();

  // Filter out users already in this tenant
  const availableUsers = (allProfiles || []).filter(
    (profile) => !tenantUsers?.some((tu: any) => tu.user_id === profile.id)
  );

  const handleAddUser = async () => {
    if (!tenant || !selectedUserId) return;
    
    await addUserToTenant.mutateAsync({
      userId: selectedUserId,
      tenantId: tenant.id,
      role: selectedRole as 'admin' | 'manager' | 'agent' | 'viewer',
    });
    
    setAddingUser(false);
    setSelectedUserId('');
    setSelectedRole('agent');
  };

  const handleRoleChange = async (userTenantId: string, newRole: string) => {
    await updateUserTenant.mutateAsync({
      id: userTenantId,
      role: newRole as 'admin' | 'manager' | 'agent' | 'viewer',
    });
  };

  const handleRemoveUser = async () => {
    if (!tenant || !userToRemove) return;
    
    await removeUserFromTenant.mutateAsync({
      userId: userToRemove.userId,
      tenantId: tenant.id,
    });
    
    setDeleteConfirmOpen(false);
    setUserToRemove(null);
  };

  const confirmRemoveUser = (userId: string, name: string) => {
    setUserToRemove({ userId, name });
    setDeleteConfirmOpen(true);
  };

  if (!tenant) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários - {tenant.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie os usuários que têm acesso a esta empresa
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            {/* Add User Section */}
            {addingUser ? (
              <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border bg-muted/50">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingProfiles ? (
                      <div className="p-2">
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : availableUsers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        Todos os usuários já estão nesta empresa
                      </div>
                    ) : (
                      availableUsers.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={profile.avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {profile.name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{profile.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="agent">Atendente</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleAddUser}
                    disabled={!selectedUserId || addUserToTenant.isPending}
                  >
                    {addUserToTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setAddingUser(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full gap-2" 
                onClick={() => setAddingUser(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar Usuário
              </Button>
            )}

            {/* Users Table */}
            {loadingUsers ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tenantUsers?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário associado a esta empresa
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantUsers?.map((ut: any) => (
                    <TableRow key={ut.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={ut.profile?.avatar || undefined} />
                            <AvatarFallback>
                              {ut.profile?.name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{ut.profile?.name || 'Usuário'}</p>
                            <p className="text-xs text-muted-foreground">
                              {ut.profile?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={ut.role} 
                          onValueChange={(value) => handleRoleChange(ut.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <Badge variant={roleBadgeVariants[ut.role] || 'outline'}>
                              {roleLabels[ut.role] || ut.role}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                            <SelectItem value="agent">Atendente</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmRemoveUser(ut.user_id, ut.profile?.name || 'Usuário')}
                          className="text-destructive hover:text-destructive"
                          aria-label={`Remover ${ut.profile?.name || 'usuário'} do escritório`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{userToRemove?.name}</strong> desta empresa?
              O usuário perderá acesso a todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeUserFromTenant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
