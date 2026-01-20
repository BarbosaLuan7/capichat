import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { Database } from '@/integrations/supabase/types';

type Label = Database['public']['Tables']['labels']['Row'];
type LabelInsert = Database['public']['Tables']['labels']['Insert'];
type LabelUpdate = Database['public']['Tables']['labels']['Update'];

export function useLabels() {
  const { currentTenant, tenants } = useTenant();
  const tenantIds = currentTenant ? [currentTenant.id] : tenants.map((t) => t.id);

  return useQuery({
    queryKey: ['labels', currentTenant?.id || 'all'],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('labels')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      // Filter by tenant (includes global labels where tenant_id is null)
      if (tenantIds.length > 0) {
        queryBuilder = queryBuilder.or(`tenant_id.is.null,tenant_id.in.(${tenantIds.join(',')})`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as Label[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - labels mudam raramente
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false, // Dados estáticos
    placeholderData: [],
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label: LabelInsert) => {
      const { data, error } = await supabase.from('labels').insert(label).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LabelUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('labels').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useLeadLabels(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead_labels', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_labels')
        .select(
          `
          *,
          labels (id, name, color, category)
        `
        )
        .eq('lead_id', leadId);

      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    staleTime: 30 * 1000, // 30 segundos
  });
}

export function useAddLeadLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, labelId }: { leadId: string; labelId: string }) => {
      const { data, error } = await supabase
        .from('lead_labels')
        .insert({ lead_id: leadId, label_id: labelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_labels', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useRemoveLeadLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, labelId }: { leadId: string; labelId: string }) => {
      const { error } = await supabase
        .from('lead_labels')
        .delete()
        .eq('lead_id', leadId)
        .eq('label_id', labelId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_labels', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
