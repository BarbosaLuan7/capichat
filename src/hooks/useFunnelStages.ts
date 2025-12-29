import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type FunnelStage = Database['public']['Tables']['funnel_stages']['Row'];
type FunnelStageInsert = Database['public']['Tables']['funnel_stages']['Insert'];
type FunnelStageUpdate = Database['public']['Tables']['funnel_stages']['Update'];

export function useFunnelStages() {
  return useQuery({
    queryKey: ['funnel_stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_stages')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) throw error;
      return data as FunnelStage[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - etapas do funil mudam raramente
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

export function useCreateFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stage: FunnelStageInsert) => {
      const { data, error } = await supabase
        .from('funnel_stages')
        .insert(stage)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel_stages'] });
    },
  });
}

export function useUpdateFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: FunnelStageUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('funnel_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel_stages'] });
    },
  });
}

export function useDeleteFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funnel_stages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel_stages'] });
    },
  });
}
