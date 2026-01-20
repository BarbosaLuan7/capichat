import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface SelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function SelectionBar({
  selectedCount,
  onCancel,
  onDelete,
  isDeleting = false,
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      className="absolute bottom-0 left-0 right-0 z-10 border-t border-border bg-card shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8"
            aria-label="Cancelar seleção"
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {selectedCount} selecionada{selectedCount > 1 ? 's' : ''}
          </span>
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </div>
    </motion.div>
  );
}
