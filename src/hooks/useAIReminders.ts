import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface AIReminder {
  hasReminder: boolean;
  taskTitle?: string;
  taskDescription?: string;
  suggestedDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export function useAIReminders() {
  const [reminder, setReminder] = useState<AIReminder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Ref para controlar cancelamento de requisições em unmount
  const isMountedRef = useRef(true);

  // Cleanup em unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const detectReminder = useCallback(async (message: string, leadName?: string) => {
    // Only check messages longer than 10 chars
    if (!message || message.trim().length < 10) {
      setReminder(null);
      return null;
    }

    setIsLoading(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'ai-detect-reminders',
        {
          body: { message, leadName },
        }
      );

      // Verificar se componente ainda está montado
      if (!isMountedRef.current) return null;

      if (functionError) {
        logger.error('Error detecting reminder:', functionError);
        setReminder(null);
        return null;
      }

      const result = data as AIReminder;

      if (result?.hasReminder) {
        setReminder(result);
        return result;
      }

      setReminder(null);
      return null;
    } catch (err) {
      // Ignorar erros se componente desmontou
      if (!isMountedRef.current) return null;

      logger.error('Error detecting reminder:', err);
      setReminder(null);
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const clearReminder = useCallback(() => {
    setReminder(null);
  }, []);

  return {
    reminder,
    isLoading,
    detectReminder,
    clearReminder,
  };
}
