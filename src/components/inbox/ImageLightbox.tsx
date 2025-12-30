import { useState, ReactNode, forwardRef } from 'react';
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

export const ImageLightbox = forwardRef<HTMLDivElement, ImageLightboxProps>(
  function ImageLightbox({ src, alt = 'Imagem', children }, ref) {
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
      // Fallback: open in new tab
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
          ref={ref}
          className="cursor-pointer hover:opacity-90 transition-opacity focusable rounded-lg"
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`Ampliar imagem: ${alt}`}
        >
          {children}
        </div>

      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setZoom(1); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Visualização de imagem</DialogTitle>
          </VisuallyHidden>
          
          {/* Controls bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent" role="toolbar" aria-label="Controles da imagem">
            <div className="flex items-center gap-2" role="group" aria-label="Controles de zoom">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 focusable"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" aria-hidden="true" />
              </Button>
              <span className="text-white text-sm min-w-[3rem] text-center" aria-live="polite">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 focusable"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 focusable"
                onClick={handleDownload}
                aria-label="Baixar imagem"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
              </Button>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 focusable"
                  aria-label="Fechar visualização"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </Button>
              </DialogClose>
            </div>
          </div>

          {/* Image container */}
          <div 
            className="flex items-center justify-center w-full h-[90vh] overflow-auto"
            onClick={() => setOpen(false)}
          >
            <img
              src={src}
              alt={alt}
              className={cn(
                "max-w-full max-h-full object-contain transition-transform duration-200",
                zoom !== 1 && "cursor-grab"
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
);

ImageLightbox.displayName = 'ImageLightbox';
