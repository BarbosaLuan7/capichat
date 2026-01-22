import React from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';

export function DropZoneOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm"
    >
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <Upload className="mx-auto mb-3 h-12 w-12 text-primary" />
        <p className="text-lg font-medium text-foreground">Solte o arquivo aqui</p>
        <p className="text-sm text-muted-foreground">Imagens, videos, audios ou documentos</p>
      </div>
    </motion.div>
  );
}
