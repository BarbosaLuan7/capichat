import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2, Users, MessageCircle, Loader2, Search, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { TenantModal } from '@/components/tenants/TenantModal';
import { TenantUsersModal } from '@/components/tenants/TenantUsersModal';
import { TenantInboxesModal } from '@/components/tenants/TenantInboxesModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useAllTenants, useCreateTenant, useUpdateTenant, useDeleteTenant } from '@/hooks/useTenants';
import { useDebounce } from '@/hooks/useDebounce';
import type { Tenant } from '@/contexts/TenantContext';

export default function TenantsSettings() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [inboxesModalOpen, setInboxesModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: tenants, isLoading } = useAllTenants();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();

  const filteredTenants = (tenants || []).filter((tenant) =>
    tenant.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const handleOpenModal = (tenant?: Tenant) => {
    setSelectedTenant(tenant || null);
    setModalOpen(true);
  };

  const handleSave = async (data: { name: string; slug: string; logo_url?: string; is_active: boolean }) => {
    if (selectedTenant) {
      await updateTenant.mutateAsync({
        id: selectedTenant.id,
        name: data.name,
        logo_url: data.logo_url || null,
        is_active: data.is_active,
      });
    } else {
      await createTenant.mutateAsync({
        name: data.name,
        slug: data.slug,
        logo_url: data.logo_url,
      });
    }
  };

  const handleDelete = async () => {
    if (selectedTenant) {
      await deleteTenant.mutateAsync(selectedTenant.id);
      setDeleteDialogOpen(false);
      setSelectedTenant(null);
    }
  };

  const handleManageUsers = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setUsersModalOpen(true);
  };

  const handleManageInboxes = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setInboxesModalOpen(true);
  };

  const handleConfirmDelete = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Configurações', href: '/settings' },
          { label: 'Empresas' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Empresas (Multi-Tenant)
          </h1>
          <p className="text-muted-foreground">
            Gerencie as empresas e suas configurações
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Empresas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{tenants?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Empresas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-success">
              {tenants?.filter((t) => t.is_active).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Empresas Inativas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-muted-foreground">
              {tenants?.filter((t) => !t.is_active).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Empresas</CardTitle>
          <CardDescription>
            Clique em uma empresa para gerenciar seus usuários e caixas de entrada
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {tenant.logo_url ? (
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={tenant.logo_url} alt={tenant.name} />
                            <AvatarFallback>{tenant.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{tenant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {tenant.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                        {tenant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleManageUsers(tenant)}>
                            <Users className="h-4 w-4 mr-2" />
                            Gerenciar Usuários
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageInboxes(tenant)}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Gerenciar Caixas
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleOpenModal(tenant)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleConfirmDelete(tenant)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <TenantModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenant={selectedTenant}
        onSave={handleSave}
        isLoading={createTenant.isPending || updateTenant.isPending}
      />

      <TenantUsersModal
        open={usersModalOpen}
        onOpenChange={setUsersModalOpen}
        tenant={selectedTenant}
      />

      <TenantInboxesModal
        open={inboxesModalOpen}
        onOpenChange={setInboxesModalOpen}
        tenant={selectedTenant}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados associados a esta empresa
              (leads, conversas, tarefas) perderão a associação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTenant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
