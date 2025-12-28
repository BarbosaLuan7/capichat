import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
}

interface TranscriptionCache {
  [key: string]: string;
}

// Cache local para evitar re-transcrever
const transcriptionCache: TranscriptionCache = {};

export function useAudioTranscription() {
  const [isTranscribing, setIsTranscribing] = useState<Record<string, boolean>>({});

  const transcribeAudio = useCallback(async (messageId: string, audioUrl: string): Promise<string | null> => {
    // Check cache first
    if (transcriptionCache[messageId]) {
      return transcriptionCache[messageId];
    }

    setIsTranscribing(prev => ({ ...prev, [messageId]: true }));

    try {
      const { data, error } = await supabase.functions.invoke<TranscriptionResult>('transcribe-audio', {
        body: { audioUrl }
      });

      if (error) {
        logger.error('Transcription error:', error);
        return null;
      }

      if (data?.success && data?.text) {
        transcriptionCache[messageId] = data.text;
        return data.text;
      }

      return null;
    } catch (err) {
      logger.error('Failed to transcribe audio:', err);
      return null;
    } finally {
      setIsTranscribing(prev => ({ ...prev, [messageId]: false }));
    }
  }, []);

  const getTranscription = useCallback((messageId: string): string | undefined => {
    return transcriptionCache[messageId];
  }, []);

  const isLoading = useCallback((messageId: string): boolean => {
    return isTranscribing[messageId] || false;
  }, [isTranscribing]);

  return {
    transcribeAudio,
    getTranscription,
    isLoading,
  };
}