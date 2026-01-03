import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type TeamMember = Database['public']['Tables']['team_members']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

// Interface do perfil com relações
export interface ProfileWithRelations extends Profile {
  team_memberships?: (TeamMember & {
    team: { id: string; name: string } | null;
  })[];
}

// Buscar todos os perfis com relações
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          team_memberships:team_members (
            id,
            team_id,
            is_supervisor,
            team:teams (id, name)
          )
        `)
        .order('name');
      
      if (error) throw error;
      return data as ProfileWithRelations[];
    },
    gcTime: 30 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Buscar perfil específico com relações
export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['profiles', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          team_memberships:team_members (
            id,
            team_id,
            is_supervisor,
            team:teams (id, name)
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as ProfileWithRelations | null;
    },
    enabled: !!id,
    gcTime: 30 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Buscar roles dos usuários
export function useUserRoles() {
  return useQuery({
    queryKey: ['user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Atualizar perfil
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ProfileUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', variables.id] });
    },
  });
}

// Atualizar disponibilidade
export function useUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_available: isAvailable })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', variables.id] });
    },
  });
}

// Atualizar role do usuário
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      role 
    }: { 
      userId: string; 
      role: AppRole;
    }) => {
      // Primeiro tenta atualizar
      const { data: existing } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      }

      return { userId, role };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// Atualizar equipes do usuário (batch)
export function useUpdateUserTeams() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      teams 
    }: { 
      userId: string; 
      teams: { teamId: string; isSupervisor: boolean }[];
    }) => {
      // 1. Remover todas as associações atuais
      await supabase
        .from('team_members')
        .delete()
        .eq('user_id', userId);

      // 2. Inserir novas associações
      if (teams.length > 0) {
        const { error } = await supabase
          .from('team_members')
          .insert(
            teams.map(t => ({
              user_id: userId,
              team_id: t.teamId,
              is_supervisor: t.isSupervisor,
            }))
          );
        
        if (error) throw error;
      }

      return { userId, teams };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// Bloquear/Desbloquear usuário
export function useToggleUserBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', variables.id] });
    },
  });
}
