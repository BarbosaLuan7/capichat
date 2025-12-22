import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Mail,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/appStore';
import { User } from '@/types';
import { UserModal } from '@/components/users/UserModal';
import { getRoleLabel } from '@/lib/permissions';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { cn } from '@/lib/utils';

const UsersSettings = () => {
  const { users, teams, addUser, updateUser, deleteUser, toggleUserStatus } = useAppStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const getTeamName = (teamId?: string) => {
    if (!teamId) return '-';
    const team = teams.find(t => t.id === teamId);
    return team?.name || '-';
  };

  const handleSave = (userData: Omit<User, 'id' | 'createdAt' | 'avatar'> & { id?: string }) => {
    if (userData.id) {
      updateUser(userData.id, userData);
      toast({ title: 'Usuário atualizado com sucesso!' });
    } else {
      addUser(userData);
      toast({ title: 'Usuário criado com sucesso!' });
    }
  };

  const handleDelete = (userId: string) => {
    deleteUser(userId);
    toast({ title: 'Usuário excluído', variant: 'destructive' });
  };

  const handleToggleStatus = (userId: string) => {
    toggleUserStatus(userId);
    toast({ title: 'Status atualizado!' });
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  const getRoleBadgeColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-primary text-primary-foreground';
      case 'manager':
        return 'bg-warning text-warning-foreground';
      case 'agent':
        return 'bg-success text-success-foreground';
      case 'viewer':
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Configurações', href: '/settings' }, { label: 'Usuários' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os membros da sua equipe</p>
        </div>
        <Button onClick={openCreateModal} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Usuários', value: users.length, icon: Shield },
          { label: 'Ativos', value: users.filter(u => u.isActive).length, icon: UserCheck },
          { label: 'Inativos', value: users.filter(u => !u.isActive).length, icon: UserX },
          { label: 'Equipes', value: teams.length, icon: Mail },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', getRoleBadgeColor(user.role))}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getTeamName(user.teamId)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={() => handleToggleStatus(user.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(user)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(user.id)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}

              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={selectedUser}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default UsersSettings;
