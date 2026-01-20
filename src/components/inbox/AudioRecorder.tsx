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

export const AudioRecorder = forwardRef<HTMLDivElement, AudioRecorderProps>(function AudioRecorder(
  { isRecording, duration, audioUrl, formatDuration, onStart, onStop, onCancel, onSend },
  ref
) {
  // Generate stable bar heights once to prevent layout thrashing
  const barHeights = useMemo(() => [...Array(20)].map(() => Math.random() * 20 + 8), []);

  if (!isRecording && !audioUrl) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3"
    >
      {isRecording ? (
        <>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium text-foreground">{formatDuration(duration)}</span>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-1" aria-hidden="true" role="presentation">
              {barHeights.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1 rounded-full bg-primary transition-all duration-150',
                    isRecording && 'animate-pulse'
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
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Cancelar gravação"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onStop}
              className="bg-primary hover:bg-primary/90"
              aria-label="Parar gravação"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : audioUrl ? (
        <>
          <audio src={audioUrl} controls className="h-10 flex-1" />

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Descartar áudio"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onSend}
              className="gradient-primary"
              aria-label="Enviar áudio"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
});
