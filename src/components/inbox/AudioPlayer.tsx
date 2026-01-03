import { useState, useRef, useEffect, memo, forwardRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const PLAYBACK_SPEEDS = [1, 1.5, 2, 0.5] as const;

interface AudioPlayerProps {
  src: string;
  className?: string;
  'aria-label'?: string;
}

const AudioPlayerComponent = forwardRef<HTMLDivElement, AudioPlayerProps>(({ src, className, 'aria-label': ariaLabel }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate as typeof PLAYBACK_SPEEDS[number]);
    const nextSpeed = PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={ref} className={cn("flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-[200px]", className)} role="region" aria-label={ariaLabel || 'Player de áudio'}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={togglePlay}
              disabled={!isLoaded}
              aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{isPlaying ? 'Pausar' : 'Reproduzir'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-10 shrink-0">
          {formatTime(currentTime)}
        </span>
        
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
          disabled={!isLoaded}
        />
        
        <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">
          {formatTime(duration)}
        </span>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-medium shrink-0"
              onClick={cyclePlaybackRate}
              aria-label={`Velocidade de reprodução: ${playbackRate}x. Clique para alterar.`}
            >
              {playbackRate}x
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Velocidade de reprodução (clique para alterar)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
    </div>
  );
});

AudioPlayerComponent.displayName = 'AudioPlayer';

export const AudioPlayer = memo(AudioPlayerComponent, (prev, next) =>
  prev.src === next.src && prev.className === next.className
);
