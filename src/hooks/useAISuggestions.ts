import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface AISuggestion {
  text: string;
  intent: 'greeting' | 'info' | 'action' | 'closing';
}

interface UseAISuggestionsOptions {
  conversationId?: string;
  lead?: {
    name: string;
    temperature?: string;
    source?: string;
    stage?: string;
    labels?: { name: string }[];
  };
}

interface CachedSuggestions {
  suggestions: AISuggestion[];
  cacheKey: string;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Gera uma chave de cache baseada no conversationId e lastMessageId.
 * Isso garante que só buscamos novas sugestões quando há novas mensagens.
 */
function generateCacheKey(conversationId: string | undefined, messages: any[]): string {
  if (!conversationId || !messages.length) return '';

  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage?.id || lastMessage?.created_at || 'unknown';

  return `${conversationId}:${lastMessageId}:${messages.length}`;
}

export function useAISuggestions() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache local por conversationId + lastMessageId
  const cacheRef = useRef<CachedSuggestions | null>(null);

  const fetchSuggestions = useCallback(
    async (
      messages: any[],
      lead: UseAISuggestionsOptions['lead'],
      templates?: any[],
      forceRefresh = false,
      conversationId?: string
    ) => {
      if (!messages || messages.length === 0) {
        setSuggestions([]);
        return;
      }

      // Gerar chave de cache
      const cacheKey = generateCacheKey(conversationId, messages);

      // Verificar cache (a menos que seja forceRefresh)
      if (!forceRefresh && cacheRef.current) {
        const { cacheKey: cachedKey, timestamp, suggestions: cachedSuggestions } = cacheRef.current;
        const isValidCache = cachedKey === cacheKey && Date.now() - timestamp < CACHE_TTL_MS;

        if (isValidCache) {
          logger.log('[useAISuggestions] Usando sugestões em cache para:', cacheKey);
          setSuggestions(cachedSuggestions);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke(
          'ai-suggest-replies',
          {
            body: { messages, lead, templates },
          }
        );

        if (functionError) {
          throw functionError;
        }

        if (data?.error) {
          if (data.error.includes('Rate limit')) {
            toast.error('Limite de requisições atingido. Tente novamente em instantes.');
          } else if (data.error.includes('credits')) {
            toast.error('Créditos de IA esgotados.');
          }
          setError(data.error);
          setSuggestions([]);
          return;
        }

        const result = data?.suggestions || [];
        setSuggestions(result);

        // Salvar no cache
        cacheRef.current = {
          suggestions: result,
          cacheKey,
          timestamp: Date.now(),
        };

        logger.log('[useAISuggestions] Sugestões carregadas e cacheadas para:', cacheKey);
      } catch (err: any) {
        logger.error('Error fetching AI suggestions:', err);
        setError(err.message || 'Erro ao buscar sugestões');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  // Limpar cache (chamar ao enviar mensagem)
  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions,
    clearSuggestions,
    invalidateCache,
  };
}
