import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { Database } from '@/integrations/supabase/types';

type FunnelStage = Database['public']['Tables']['funnel_stages']['Row'];
type FunnelStageInsert = Database['public']['Tables']['funnel_stages']['Insert'];
type FunnelStageUpdate = Database['public']['Tables']['funnel_stages']['Update'];

export function useFunnelStages() {
  const { currentTenant, tenants } = useTenant();
  const tenantIds = currentTenant ? [currentTenant.id] : tenants.map(t => t.id);

  return useQuery({
    queryKey: ['funnel_stages', currentTenant?.id || 'all'],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('funnel_stages')
        .select('*')
        .order('order', { ascending: true });

      // Filter by tenant (includes global stages where tenant_id is null)
      if (tenantIds.length > 0) {
        queryBuilder = queryBuilder.or(`tenant_id.is.null,tenant_id.in.(${tenantIds.join(',')})`);
      }

      const { data, error } = await queryBuilder;
      
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
