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
  onDeleteForEveryone: () => void;
  isDeletingForEveryone?: boolean;
}

export function DeleteMessagesModal({
  open,
  onOpenChange,
  selectedCount,
  onDeleteForEveryone,
  isDeletingForEveryone = false,
}: DeleteMessagesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Apagar mensagem
          </DialogTitle>
          <DialogDescription>
            {selectedCount === 1
              ? 'A mensagem será apagada para você e para o contato. Esta ação não pode ser desfeita.'
              : `As ${selectedCount} mensagens serão apagadas para você e para o contato. Esta ação não pode ser desfeita.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeletingForEveryone}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onDeleteForEveryone}
            disabled={isDeletingForEveryone}
            className="w-full sm:w-auto"
          >
            {isDeletingForEveryone ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
