import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { aiCache, generateMessagesKey } from '@/lib/aiCache';
import { logger } from '@/lib/logger';

interface AIClassification {
  suggestedBenefit?: string;
  suggestedTemperature: 'cold' | 'warm' | 'hot';
  suggestedLabels: string[];
  healthConditions?: string[];
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
}

export function useAIClassification() {
  const [classification, setClassification] = useState<AIClassification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref para controlar cancelamento de requisições em unmount
  const isMountedRef = useRef(true);

  // Cleanup em unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchClassification = useCallback(
    async (
      messages: any[],
      lead: {
        name: string;
        temperature?: string;
        labels?: { name: string }[];
      },
      availableLabels: any[],
      forceRefresh = false
    ) => {
      if (!messages || messages.length === 0) {
        setClassification(null);
        return;
      }

      // Check cache first (unless forcing refresh)
      const cacheKey = generateMessagesKey('classification', messages);

      if (!forceRefresh) {
        const cached = aiCache.get<AIClassification>(cacheKey);
        if (cached) {
          setClassification(cached);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke('ai-classify-lead', {
          body: { messages, lead, availableLabels },
        });

        // Verificar se componente ainda está montado antes de atualizar estado
        if (!isMountedRef.current) return;

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
          setClassification(null);
          return;
        }

        setClassification(data);

        // Cache the result
        aiCache.set(cacheKey, data);
      } catch (err) {
        // Ignorar erros se componente desmontou
        if (!isMountedRef.current) return;

        const message = err instanceof Error ? err.message : 'Erro ao classificar lead';
        logger.error('Error fetching AI classification:', err);
        setError(message);
        setClassification(null);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  const clearClassification = useCallback(() => {
    setClassification(null);
    setError(null);
  }, []);

  return {
    classification,
    isLoading,
    error,
    fetchClassification,
    clearClassification,
  };
}
