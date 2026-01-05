import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];
type TeamInsert = Database['public']['Tables']['teams']['Insert'];
type TeamUpdate = Database['public']['Tables']['teams']['Update'];
type TeamMember = Database['public']['Tables']['team_members']['Row'];
type TeamWhatsAppConfig = Database['public']['Tables']['team_whatsapp_configs']['Row'];

// Interface completa da equipe com relações
export interface TeamWithRelations extends Team {
  supervisor?: { id: string; name: string; email: string; avatar: string | null } | null;
  team_members?: (TeamMember & { 
    user: { id: string; name: string; email: string; avatar: string | null } 
  })[];
  team_whatsapp_configs?: (TeamWhatsAppConfig & {
    whatsapp_config: { id: string; name: string; phone_number: string | null }
  })[];
}

// Buscar todas as equipes com relações
export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          supervisor:supervisor_id (id, name, email, avatar),
          team_members (
            id,
            user_id,
            is_supervisor,
            created_at,
            user:user_id (id, name, email, avatar)
          ),
          team_whatsapp_configs (
            id,
            whatsapp_config_id,
            created_at,
            whatsapp_config:whatsapp_config_id (id, name, phone_number)
          )
        `)
        .order('name');
      
      if (error) throw error;
      return data as unknown as TeamWithRelations[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Buscar equipe específica
export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          supervisor:supervisor_id (id, name, email, avatar),
          team_members (
            id,
            user_id,
            is_supervisor,
            created_at,
            user:user_id (id, name, email, avatar)
          ),
          team_whatsapp_configs (
            id,
            whatsapp_config_id,
            created_at,
            whatsapp_config:whatsapp_config_id (id, name, phone_number)
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as unknown as TeamWithRelations | null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Manter compatibilidade com código antigo (busca membros via team_members)
export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team_members', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          is_supervisor,
          created_at,
          user:user_id (id, name, email, avatar)
        `)
        .eq('team_id', teamId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });
}

// Criar equipe
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (team: TeamInsert) => {
      // Se marcou como padrão, desmarcar outras do mesmo tenant
      if (team.is_default && team.tenant_id) {
        await supabase
          .from('teams')
          .update({ is_default: false })
          .eq('tenant_id', team.tenant_id)
          .eq('is_default', true);
      }
      
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

// Atualizar equipe
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TeamUpdate & { id: string }) => {
      // Se marcou como padrão, desmarcar outras do mesmo tenant
      if (updates.is_default) {
        const { data: team } = await supabase
          .from('teams')
          .select('tenant_id')
          .eq('id', id)
          .maybeSingle();
        
        if (team?.tenant_id) {
          await supabase
            .from('teams')
            .update({ is_default: false })
            .eq('tenant_id', team.tenant_id)
            .eq('is_default', true)
            .neq('id', id);
        }
      }
      
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

// Deletar equipe
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// ========== TEAM MEMBERS ==========

// Atualizar membros da equipe (batch update)
export function useUpdateTeamMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      teamId, 
      members 
    }: { 
      teamId: string; 
      members: { userId: string; isSupervisor: boolean }[] 
    }) => {
      // 1. Remover todos os membros atuais
      await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId);

      // 2. Inserir novos membros
      if (members.length > 0) {
        const { error } = await supabase
          .from('team_members')
          .insert(
            members.map(m => ({
              team_id: teamId,
              user_id: m.userId,
              is_supervisor: m.isSupervisor,
            }))
          );
        
        if (error) throw error;
      }

      return { teamId, members };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['team_members', variables.teamId] });
    },
  });
}

// ========== TEAM WHATSAPP CONFIGS ==========

// Atualizar canais WhatsApp da equipe
export function useUpdateTeamWhatsAppConfigs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      teamId, 
      configIds 
    }: { 
      teamId: string; 
      configIds: string[] 
    }) => {
      // 1. Remover todos os canais atuais
      await supabase
        .from('team_whatsapp_configs')
        .delete()
        .eq('team_id', teamId);

      // 2. Inserir novos canais
      if (configIds.length > 0) {
        const { error } = await supabase
          .from('team_whatsapp_configs')
          .insert(
            configIds.map(configId => ({
              team_id: teamId,
              whatsapp_config_id: configId,
            }))
          );
        
        if (error) throw error;
      }

      return { teamId, configIds };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
    },
  });
}
