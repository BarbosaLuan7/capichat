import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Tenant, UserTenant } from '@/contexts/TenantContext';

// ==========================================
// TENANT QUERIES
// ==========================================

export function useAllTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Tenant[];
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useTenantById(id: string | undefined) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Tenant | null;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ==========================================
// TENANT MUTATIONS
// ==========================================

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenant: { 
      name: string; 
      slug: string; 
      logo_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert({
          name: tenant.name,
          slug: tenant.slug,
          logo_url: tenant.logo_url,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Empresa criada com sucesso');
    },
    onError: (error: Error) => {
      logger.error('Error creating tenant:', error);
      toast.error('Erro ao criar empresa');
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      name,
      logo_url,
      is_active,
    }: { 
      id: string; 
      name?: string; 
      logo_url?: string | null;
      is_active?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (logo_url !== undefined) updates.logo_url = logo_url;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenants', variables.id] });
      toast.success('Empresa atualizada com sucesso');
    },
    onError: (error: Error) => {
      logger.error('Error updating tenant:', error);
      toast.error('Erro ao atualizar empresa');
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Empresa excluída com sucesso');
    },
    onError: (error: Error) => {
      logger.error('Error deleting tenant:', error);
      toast.error('Erro ao excluir empresa');
    },
  });
}

// ==========================================
// USER TENANT QUERIES
// ==========================================

export function useTenantUsers(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant_users', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
          *,
          profile:profiles!user_tenants_user_id_fkey(*)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useUserTenantAssociations(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_tenant_associations', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      return data as (UserTenant & { tenant: Tenant })[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ==========================================
// USER TENANT MUTATIONS
// ==========================================

export function useAddUserToTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      tenantId, 
      role = 'agent' 
    }: { 
      userId: string; 
      tenantId: string; 
      role?: 'admin' | 'manager' | 'agent' | 'viewer';
    }) => {
      const { data, error } = await supabase
        .from('user_tenants')
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          role,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant_users', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['user_tenant_associations', variables.userId] });
      toast.success('Usuário adicionado à empresa');
    },
    onError: (error: Error) => {
      logger.error('Error adding user to tenant:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Usuário já está associado a esta empresa');
      } else {
        toast.error('Erro ao adicionar usuário à empresa');
      }
    },
  });
}

export function useUpdateUserTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      role, 
      is_active 
    }: { 
      id: string;
      role?: 'admin' | 'manager' | 'agent' | 'viewer';
      is_active?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (role !== undefined) updates.role = role;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await supabase
        .from('user_tenants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_users'] });
      queryClient.invalidateQueries({ queryKey: ['user_tenant_associations'] });
      toast.success('Associação atualizada');
    },
    onError: (error: Error) => {
      logger.error('Error updating user tenant:', error);
      toast.error('Erro ao atualizar associação');
    },
  });
}

export function useRemoveUserFromTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, tenantId }: { userId: string; tenantId: string }) => {
      const { error } = await supabase
        .from('user_tenants')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant_users', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['user_tenant_associations', variables.userId] });
      toast.success('Usuário removido da empresa');
    },
    onError: (error: Error) => {
      logger.error('Error removing user from tenant:', error);
      toast.error('Erro ao remover usuário da empresa');
    },
  });
}

// ==========================================
// WHATSAPP CONFIG BY TENANT
// ==========================================

export function useTenantWhatsAppConfigs(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['whatsapp_configs_by_tenant', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_config')
        .select('*')
        .order('name');

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useAssignWhatsAppToTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId, tenantId }: { configId: string; tenantId: string | null }) => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .update({ tenant_id: tenantId })
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_configs_by_tenant'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      toast.success('Caixa de entrada associada');
    },
    onError: (error: Error) => {
      logger.error('Error assigning WhatsApp to tenant:', error);
      toast.error('Erro ao associar caixa de entrada');
    },
  });
}
