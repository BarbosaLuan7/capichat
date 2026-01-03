import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  GitBranch,
  UserPlus,
  Tag,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useProfiles } from '@/hooks/useProfiles';
import { useLabels } from '@/hooks/useLabels';
import { useUpdateLead, useDeleteLead } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedIds, onClearSelection }: BulkActionsBarProps) {
  const { data: stages = [] } = useFunnelStages();
  const { data: profiles = [] } = useProfiles();
  const { data: labels = [] } = useLabels();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMoveToStage = async (stageId: string) => {
    setIsProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateLead.mutateAsync({ id, stage_id: stageId })
        )
      );
      const stage = stages.find((s) => s.id === stageId);
      toast.success(`${selectedIds.length} leads movidos para "${stage?.name}"`);
      onClearSelection();
    } catch (error) {
      toast.error('Erro ao mover leads');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignTo = async (userId: string) => {
    setIsProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateLead.mutateAsync({ id, assigned_to: userId })
        )
      );
      const user = profiles.find((p) => p.id === userId);
      toast.success(`${selectedIds.length} leads atribuídos a "${user?.name}"`);
      onClearSelection();
    } catch (error) {
      toast.error('Erro ao atribuir leads');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBulk = async () => {
    setIsProcessing(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteLead.mutateAsync(id)));
      toast.success(`${selectedIds.length} leads excluídos`);
      onClearSelection();
    } catch (error) {
      toast.error('Erro ao excluir leads');
    } finally {
      setIsProcessing(false);
      setDeleteDialogOpen(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 bg-background border border-border shadow-lg rounded-lg p-2 pl-4">
            <span className="text-sm font-medium text-foreground mr-2">
              {selectedIds.length} selecionados
            </span>

            {/* Move to stage */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isProcessing}>
                  <GitBranch className="w-4 h-4 mr-2" />
                  Mover
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {stages.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => handleMoveToStage(stage.id)}
                    className="gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign to */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isProcessing}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Atribuir
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {profiles.map((profile) => (
                  <DropdownMenuItem
                    key={profile.id}
                    onClick={() => handleAssignTo(profile.id)}
                  >
                    {profile.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isProcessing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>

            {/* Clear selection */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="ml-2"
              aria-label="Cancelar seleção"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.length} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os leads selecionados serão
              permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBulk}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
