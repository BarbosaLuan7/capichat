import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const AudioRecorder = React.lazy(() =>
  import('@/components/inbox/AudioRecorder').then((m) => ({ default: m.AudioRecorder }))
);

interface AudioRecorderSectionProps {
  isRecording: boolean;
  duration: number;
  audioUrl: string | null;
  formatDuration: (seconds: number) => string;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onSend: () => void;
}

export function AudioRecorderSection({
  isRecording,
  duration,
  audioUrl,
  formatDuration,
  onStart,
  onStop,
  onCancel,
  onSend,
}: AudioRecorderSectionProps) {
  return (
    <div className="border-t border-border px-4 py-2">
      <div className="mx-auto max-w-3xl">
        <Suspense
          fallback={
            <div className="py-4">
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            </div>
          }
        >
          <AudioRecorder
            isRecording={isRecording}
            duration={duration}
            audioUrl={audioUrl}
            formatDuration={formatDuration}
            onStart={onStart}
            onStop={onStop}
            onCancel={onCancel}
            onSend={onSend}
          />
        </Suspense>
      </div>
    </div>
  );
}
