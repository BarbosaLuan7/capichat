import React from 'react';
import { X, Trash2, Forward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface SelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onDelete: () => void;
  onForward?: () => void;
  isDeleting?: boolean;
}

export function SelectionBar({
  selectedCount,
  onCancel,
  onDelete,
  onForward,
  isDeleting = false,
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      className="absolute bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-10"
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8"
            aria-label="Cancelar seleção"
          >
            <X className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {selectedCount} selecionada{selectedCount > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onForward}
            disabled={true} // Desabilitado por enquanto - implementação futura
            className="gap-1.5"
          >
            <Forward className="w-4 h-4" />
            Encaminhar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
