import { useState, ReactNode } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  children: ReactNode;
}

export function ImageLightbox({ src, alt = 'Imagem', children }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `imagem-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(src, '_blank');
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <div
        className="focusable cursor-pointer rounded-lg transition-opacity hover:opacity-90"
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Ampliar imagem: ${alt}`}
      >
        {children}
      </div>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setZoom(1);
        }}
      >
        <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden border-none bg-black/95 p-0">
          <VisuallyHidden>
            <DialogTitle>Visualização de imagem</DialogTitle>
          </VisuallyHidden>

          <div
            className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3"
            role="toolbar"
            aria-label="Controles da imagem"
          >
            <div className="flex items-center gap-2" role="group" aria-label="Controles de zoom">
              <Button
                variant="ghost"
                size="icon"
                className="focusable h-8 w-8 text-white hover:bg-white/20"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="min-w-[3rem] text-center text-sm text-white" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="focusable h-8 w-8 text-white hover:bg-white/20"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="focusable h-8 w-8 text-white hover:bg-white/20"
                onClick={handleDownload}
                aria-label="Baixar imagem"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </Button>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="focusable h-8 w-8 text-white hover:bg-white/20"
                  aria-label="Fechar visualização"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DialogClose>
            </div>
          </div>

          <div
            className="flex h-[90vh] w-full items-center justify-center overflow-auto"
            onClick={() => setOpen(false)}
          >
            <img
              src={src}
              alt={alt}
              className={cn(
                'max-h-full max-w-full object-contain transition-transform duration-200',
                zoom !== 1 && 'cursor-grab'
              )}
              style={{ transform: `scale(${zoom})` }}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
