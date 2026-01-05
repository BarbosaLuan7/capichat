import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const CACHE_KEY_PREFIX = 'lead_avatar_attempt_';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hora

export function useLeadAvatarFetch() {
  const shouldAttemptFetch = useCallback((leadId: string): boolean => {
    try {
      const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${leadId}`);
      if (!cached) return true;
      
      const timestamp = parseInt(cached, 10);
      return Date.now() - timestamp > CACHE_DURATION_MS;
    } catch {
      return true;
    }
  }, []);

  const markAttempt = useCallback((leadId: string) => {
    try {
      sessionStorage.setItem(`${CACHE_KEY_PREFIX}${leadId}`, Date.now().toString());
    } catch {
      // sessionStorage pode estar cheio ou desabilitado
    }
  }, []);

  const fetchAvatar = useCallback(async (
    leadId: string, 
    phone: string
  ): Promise<string | null> => {
    if (!leadId || !phone) return null;
    if (!shouldAttemptFetch(leadId)) return null;

    // Marcar tentativa antes de fazer a chamada
    markAttempt(leadId);

    try {
      const { data, error } = await supabase.functions.invoke('get-whatsapp-avatar', {
        body: { lead_id: leadId, phone }
      });

      if (error) {
        logger.warn('[useLeadAvatarFetch] Erro na função:', error.message);
        return null;
      }

      return data?.avatar_url || null;
    } catch (err) {
      logger.warn('[useLeadAvatarFetch] Erro ao buscar avatar:', err);
      return null;
    }
  }, [shouldAttemptFetch, markAttempt]);

  return { fetchAvatar };
}
