import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { Database } from '@/integrations/supabase/types';

type Template = Database['public']['Tables']['templates']['Row'];
type TemplateInsert = Database['public']['Tables']['templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['templates']['Update'];

export function useTemplates(enabled: boolean = true) {
  const { currentTenant, tenants } = useTenant();
  const tenantIds = currentTenant ? [currentTenant.id] : tenants.map((t) => t.id);

  return useQuery({
    queryKey: ['templates', currentTenant?.id || 'all'],
    queryFn: async () => {
      let queryBuilder = supabase.from('templates').select('*').order('name');

      // Filter by tenant (includes global templates where tenant_id is null)
      if (tenantIds.length > 0) {
        queryBuilder = queryBuilder.or(`tenant_id.is.null,tenant_id.in.(${tenantIds.join(',')})`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as Template[];
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - templates mudam pouco
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Dados estáticos
    placeholderData: [],
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: TemplateInsert) => {
      const { data, error } = await supabase.from('templates').insert(template).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TemplateUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('templates').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
