import { useMemo, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  isRecording: boolean;
  duration: number;
  audioUrl: string | null;
  formatDuration: (seconds: number) => string;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onSend: () => void;
}

export const AudioRecorder = forwardRef<HTMLDivElement, AudioRecorderProps>(function AudioRecorder({
  isRecording,
  duration,
  audioUrl,
  formatDuration,
  onStart,
  onStop,
  onCancel,
  onSend,
}, ref) {
  // Generate stable bar heights once to prevent layout thrashing
  const barHeights = useMemo(() => 
    [...Array(20)].map(() => Math.random() * 20 + 8),
    []
  );

  if (!isRecording && !audioUrl) {
    return null;
  }

  return (
    <div ref={ref} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
      {isRecording ? (
        <>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              {formatDuration(duration)}
            </span>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1">
              {barHeights.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 bg-primary rounded-full transition-all duration-150",
                    isRecording && "animate-pulse"
                  )}
                  style={{
                    height: `${height}px`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Cancelar gravação"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onStop}
              className="bg-primary hover:bg-primary/90"
              aria-label="Parar gravação"
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </>
      ) : audioUrl ? (
        <>
          <audio src={audioUrl} controls className="flex-1 h-10" />
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Descartar áudio"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onSend}
              className="gradient-primary"
              aria-label="Enviar áudio"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
});
