import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useAISuggestions() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (
    messages: any[],
    lead: UseAISuggestionsOptions['lead'],
    templates?: any[]
  ) => {
    if (!messages || messages.length === 0) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('ai-suggest-replies', {
        body: { messages, lead, templates }
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
        setSuggestions([]);
        return;
      }

      setSuggestions(data?.suggestions || []);
    } catch (err: any) {
      console.error('Error fetching AI suggestions:', err);
      setError(err.message || 'Erro ao buscar sugestões');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions,
    clearSuggestions
  };
}
