import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];
type TeamInsert = Database['public']['Tables']['teams']['Insert'];
type TeamUpdate = Database['public']['Tables']['teams']['Update'];

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          supervisor:supervisor_id (id, name, email, avatar)
        `)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          supervisor:supervisor_id (id, name, email, avatar)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team_members', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('team_id', teamId)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (team: TeamInsert) => {
      const { data, error } = await supabase
        .from('teams')
        .insert(team)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TeamUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.id] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Primeiro, limpar team_id dos profiles dessa equipe
      await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', id);
      
      // Depois, deletar a equipe
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// Hook para atualizar membros da equipe (profiles.team_id)
export function useUpdateTeamMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memberIds }: { teamId: string; memberIds: string[] }) => {
      // 1. Remover team_id de todos os profiles que estavam nessa equipe
      const { error: removeError } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', teamId);
      
      if (removeError) throw removeError;

      // 2. Atribuir team_id aos novos membros
      if (memberIds.length > 0) {
        const { error: addError } = await supabase
          .from('profiles')
          .update({ team_id: teamId })
          .in('id', memberIds);
        
        if (addError) throw addError;
      }

      return { teamId, memberIds };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['team_members', variables.teamId] });
    },
  });
}
