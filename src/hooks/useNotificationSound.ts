import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface UseNotificationSoundOptions {
  enabled?: boolean;
  volume?: number;
}

/**
 * Hook for playing notification sounds when new messages arrive.
 * Uses Web Audio API for reliable playback.
 */
export function useNotificationSound(options: UseNotificationSoundOptions = {}) {
  const { enabled = true, volume = 0.5 } = options;
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isLoadingRef = useRef(false);
  
  // Initialize audio context and load notification sound
  const initAudio = useCallback(async () => {
    if (audioContextRef.current || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    
    try {
      // Create AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Generate a simple notification tone programmatically (no external file needed)
      const sampleRate = audioContextRef.current.sampleRate;
      const duration = 0.15; // 150ms
      const buffer = audioContextRef.current.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Create a pleasant notification beep (two-tone chord)
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 15); // Quick decay
        // Two harmonious frequencies for a pleasant "ping"
        data[i] = envelope * 0.5 * (
          Math.sin(2 * Math.PI * 880 * t) + // A5
          Math.sin(2 * Math.PI * 1318.5 * t) * 0.5 // E6
        );
      }
      
      audioBufferRef.current = buffer;
    } catch (error) {
      console.warn('[NotificationSound] Failed to initialize audio:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);
  
  // Play notification sound
  const playSound = useCallback(() => {
    if (!enabled) return;
    
    // Initialize on first play (requires user interaction)
    if (!audioContextRef.current) {
      initAudio().then(() => {
        if (audioContextRef.current && audioBufferRef.current) {
          const source = audioContextRef.current.createBufferSource();
          const gainNode = audioContextRef.current.createGain();
          
          source.buffer = audioBufferRef.current;
          gainNode.gain.value = volume;
          
          source.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          source.start();
        }
      });
      return;
    }
    
    // Resume audio context if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    if (audioBufferRef.current) {
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();
      
      source.buffer = audioBufferRef.current;
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start();
    }
  }, [enabled, volume, initAudio]);
  
  // Show visual notification
  const showNotification = useCallback((message: string, leadName?: string) => {
    const title = leadName ? `Nova mensagem de ${leadName}` : 'Nova mensagem';
    toast.info(title, {
      description: message.length > 50 ? message.substring(0, 50) + '...' : message,
      duration: 4000,
    });
  }, []);
  
  // Notify with sound and visual
  const notify = useCallback((message: string, leadName?: string) => {
    playSound();
    showNotification(message, leadName);
  }, [playSound, showNotification]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);
  
  return {
    playSound,
    showNotification,
    notify,
  };
}
