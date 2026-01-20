import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { motion } from 'framer-motion';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfiles, useUserRoles, type ProfileWithRelations } from '@/hooks/useProfiles';
import { UserDetailsSheet } from '@/components/users/UserDetailsSheet';
import { UserEditModal } from '@/components/users/UserEditModal';
import { UserTeamsModal } from '@/components/users/UserTeamsModal';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { getRoleLabel, getRoleColor, SELECTABLE_ROLES } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const UsersSettings = () => {
  const { data: profiles, isLoading, refetch } = useProfiles();
  const { data: userRoles } = useUserRoles();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<ProfileWithRelations | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const getUserRole = (userId: string): AppRole => {
    const role = userRoles?.find((r) => r.user_id === userId);
    return role?.role || 'agent';
  };

  const filteredUsers = useMemo(() => {
    let result = profiles || [];

    // Filtro de busca
    if (debouncedSearch) {
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }

    // Filtro de role
    if (roleFilter !== 'all') {
      result = result.filter((user) => getUserRole(user.id) === roleFilter);
    }

    return result;
  }, [profiles, debouncedSearch, roleFilter, userRoles]);

  const totalUsers = profiles?.length || 0;
  const contractedUsers = 12; // TODO: pegar do tenant

  const handleUserClick = (user: ProfileWithRelations) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const handleEdit = () => {
    setDetailsOpen(false);
    setEditOpen(true);
  };

  const handleEditTeams = () => {
    setDetailsOpen(false);
    setTeamsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          items={[{ label: 'Configurações', href: '/settings' }, { label: 'Usuários' }]}
        />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 max-w-md flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        items={[{ label: 'Configurações', href: '/settings' }, { label: 'Usuários' }]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {filteredUsers.length} de {contractedUsers} usuários contratados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {SELECTABLE_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Usuários */}
      <div className="space-y-1">
        {filteredUsers.map((user, index) => {
          const role = getUserRole(user.id);

          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleUserClick(user)}
              className="flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{user.name}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Badge especial para dono da conta */}
                {user.is_account_owner && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/10 text-amber-600"
                  >
                    Administrador da conta
                  </Badge>
                )}

                {/* Badge de role */}
                <Badge className={cn(getRoleColor(role))}>{getRoleLabel(role)}</Badge>
              </div>
            </motion.div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Nenhum usuário encontrado</div>
        )}
      </div>

      {/* Sheet de Detalhes */}
      <UserDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        user={selectedUser}
        userRole={selectedUser ? getUserRole(selectedUser.id) : 'agent'}
        onEdit={handleEdit}
        onEditTeams={handleEditTeams}
      />

      {/* Modal de Edição */}
      <UserEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        user={selectedUser}
        userRole={selectedUser ? getUserRole(selectedUser.id) : 'agent'}
      />

      {/* Modal de Equipes */}
      <UserTeamsModal open={teamsModalOpen} onOpenChange={setTeamsModalOpen} user={selectedUser} />

      {/* Modal de Criar Usuário */}
      <CreateUserModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  );
};

export default UsersSettings;
