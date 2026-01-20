import { useState } from 'react';
import { MessageCircle, Plus, Trash2, Loader2, Phone } from 'lucide-react';
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
import { useTenantWhatsAppConfigs, useAssignWhatsAppToTenant } from '@/hooks/useTenants';
import { useWhatsAppConfigs } from '@/hooks/useWhatsAppConfig';
import type { Tenant } from '@/contexts/TenantContext';

interface TenantInboxesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
}

export function TenantInboxesModal({ open, onOpenChange, tenant }: TenantInboxesModalProps) {
  const [addingInbox, setAddingInbox] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [configToRemove, setConfigToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: tenantInboxes, isLoading: loadingTenantInboxes } = useTenantWhatsAppConfigs(
    tenant?.id
  );
  const { data: allConfigs, isLoading: loadingAllConfigs } = useWhatsAppConfigs();
  const assignWhatsApp = useAssignWhatsAppToTenant();

  // Filter configs that are not assigned to any tenant
  const availableConfigs = (allConfigs || []).filter((config) => !(config as any).tenant_id);

  const handleAssignInbox = async () => {
    if (!tenant || !selectedConfigId) return;

    await assignWhatsApp.mutateAsync({
      configId: selectedConfigId,
      tenantId: tenant.id,
    });

    setAddingInbox(false);
    setSelectedConfigId('');
  };

  const handleRemoveInbox = async () => {
    if (!configToRemove) return;

    await assignWhatsApp.mutateAsync({
      configId: configToRemove.id,
      tenantId: null,
    });

    setRemoveConfirmOpen(false);
    setConfigToRemove(null);
  };

  const confirmRemoveInbox = (id: string, name: string) => {
    setConfigToRemove({ id, name });
    setRemoveConfirmOpen(true);
  };

  if (!tenant) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Caixas de Entrada - {tenant.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie as caixas de entrada (números WhatsApp) desta empresa
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-auto">
            {/* Add Inbox Section */}
            {addingInbox ? (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3 sm:flex-row">
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma caixa de entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingAllConfigs ? (
                      <div className="p-2">
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : availableConfigs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        Todas as caixas já estão associadas
                      </div>
                    ) : (
                      availableConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{config.name}</span>
                            {config.phone_number && (
                              <span className="text-muted-foreground">({config.phone_number})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAssignInbox}
                    disabled={!selectedConfigId || assignWhatsApp.isPending}
                  >
                    {assignWhatsApp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Associar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingInbox(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setAddingInbox(true)}
              >
                <Plus className="h-4 w-4" />
                Associar Caixa de Entrada
              </Button>
            )}

            {/* Inboxes Table */}
            {loadingTenantInboxes ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tenantInboxes?.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma caixa de entrada associada a esta empresa
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantInboxes?.map((config: any) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell>
                        {config.phone_number || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {config.provider}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.is_active ? 'default' : 'secondary'}>
                          {config.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmRemoveInbox(config.id, config.name)}
                          className="text-destructive hover:text-destructive"
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
      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover caixa de entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desassociar <strong>{configToRemove?.name}</strong> desta empresa? A caixa
              ficará disponível para associar a outra empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveInbox}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {assignWhatsApp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
