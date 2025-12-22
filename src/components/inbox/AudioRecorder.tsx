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

export function AudioRecorder({
  isRecording,
  duration,
  audioUrl,
  formatDuration,
  onStart,
  onStop,
  onCancel,
  onSend,
}: AudioRecorderProps) {
  if (!isRecording && !audioUrl) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
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
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 bg-primary rounded-full transition-all duration-150",
                    isRecording && "animate-pulse"
                  )}
                  style={{
                    height: `${Math.random() * 20 + 8}px`,
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
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onStop}
              className="bg-primary hover:bg-primary/90"
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
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onSend}
              className="gradient-primary"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
