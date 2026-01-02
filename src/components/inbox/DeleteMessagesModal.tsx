import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteMessagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  isDeletingForMe?: boolean;
  isDeletingForEveryone?: boolean;
}

export function DeleteMessagesModal({
  open,
  onOpenChange,
  selectedCount,
  onDeleteForMe,
  onDeleteForEveryone,
  isDeletingForMe = false,
  isDeletingForEveryone = false,
}: DeleteMessagesModalProps) {
  const isDeleting = isDeletingForMe || isDeletingForEveryone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Atenção
          </DialogTitle>
          <DialogDescription>
            Você deseja apagar {selectedCount === 1 ? 'a mensagem enviada' : `as ${selectedCount} mensagens enviadas`} para o contato?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={onDeleteForMe}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeletingForMe ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Apagando...
              </>
            ) : (
              'Apagar para mim'
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={onDeleteForEveryone}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeletingForEveryone ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Apagando...
              </>
            ) : (
              'Apagar para todos'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
