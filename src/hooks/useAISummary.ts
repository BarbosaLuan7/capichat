import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StructuredSummary {
  situation?: string;
  benefit?: string;
  healthConditions?: string[];
  documentsReceived?: string[];
  documentsPending?: string[];
  importantDates?: { date: string; description: string }[];
  nextSteps?: string[];
  observations?: string;
  summaryText: string;
}

interface AISummaryResult {
  summary: string;
  structured: StructuredSummary | null;
}

export function useAISummary() {
  const [summaryResult, setSummaryResult] = useState<AISummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (
    messages: any[],
    lead: {
      name: string;
      phone?: string;
      source?: string;
      stage?: string;
    }
  ) => {
    if (!messages || messages.length === 0) {
      setSummaryResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('ai-summarize-conversation', {
        body: { messages, lead }
      });

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
        setSummaryResult(null);
        return;
      }

      setSummaryResult(data);
    } catch (err: any) {
      console.error('Error fetching AI summary:', err);
      setError(err.message || 'Erro ao gerar resumo');
      setSummaryResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSummary = useCallback(() => {
    setSummaryResult(null);
    setError(null);
  }, []);

  return {
    summaryResult,
    isLoading,
    error,
    fetchSummary,
    clearSummary
  };
}
