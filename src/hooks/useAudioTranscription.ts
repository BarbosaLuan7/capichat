import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
}

interface TranscriptionCache {
  [key: string]: string;
}

// Cache local em memória para acesso rápido
const transcriptionCache: TranscriptionCache = {};

export function useAudioTranscription() {
  const [isTranscribing, setIsTranscribing] = useState<Record<string, boolean>>({});

  const transcribeAudio = useCallback(async (messageId: string, audioUrl: string): Promise<string | null> => {
    // 1. Check memory cache first (fastest)
    if (transcriptionCache[messageId]) {
      return transcriptionCache[messageId];
    }

    // 2. Check database for existing transcription
    try {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('transcription')
        .eq('id', messageId)
        .maybeSingle();

      if (existingMessage?.transcription) {
        transcriptionCache[messageId] = existingMessage.transcription;
        return existingMessage.transcription;
      }
    } catch (err) {
      // Message might not exist or other error - continue to transcribe
      logger.warn('Could not check existing transcription:', err);
    }

    // 3. Transcribe via edge function
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
        // 4. Save to database for persistence
        const { error: updateError } = await supabase
          .from('messages')
          .update({ transcription: data.text })
          .eq('id', messageId);

        if (updateError) {
          logger.error('Could not save transcription to DB:', updateError);
          toast.error('Transcrição salva apenas localmente (erro ao persistir)');
        }

        // 5. Update memory cache
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

  // Pre-populate cache from message data (for messages that already have transcription)
  const setTranscriptionFromDb = useCallback((messageId: string, transcription: string) => {
    if (transcription && !transcriptionCache[messageId]) {
      transcriptionCache[messageId] = transcription;
    }
  }, []);

  const isLoading = useCallback((messageId: string): boolean => {
    return isTranscribing[messageId] || false;
  }, [isTranscribing]);

  return {
    transcribeAudio,
    getTranscription,
    setTranscriptionFromDb,
    isLoading,
  };
}
