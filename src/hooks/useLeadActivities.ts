import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string | null;
  action: string;
  details: Record<string, any>;
  created_at: string;
  profiles?: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
}

export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async (): Promise<LeadActivity[]> => {
      if (!leadId) return [];
      
      // Fetch activities first
      const { data: activities, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!activities || activities.length === 0) return [];
      
      // Collect unique user IDs (avoid N+1 by fetching all profiles at once)
      const userIds = [...new Set(
        activities
          .map(a => a.user_id)
          .filter((id): id is string => id !== null)
      )];
      
      // Fetch all profiles in a single query
      let profilesMap: Record<string, { id: string; name: string; avatar: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        }
      }
      
      // Map activities with their profiles
      return activities.map((activity) => ({
        ...activity,
        details: (activity.details as Record<string, any>) || {},
        profiles: activity.user_id ? profilesMap[activity.user_id] || null : null,
      }));
    },
    enabled: !!leadId,
  });
}

export function useCreateLeadActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      action,
      details = {},
    }: {
      leadId: string;
      action: string;
      details?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          user_id: user?.id,
          action,
          details,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.leadId] });
    },
  });
}

// Helper to format activity messages
export function formatActivityMessage(action: string, details: Record<string, any>): string {
  switch (action) {
    case 'lead_created':
      return 'Lead criado';
    case 'stage_changed':
      return `Movido para "${details.to_stage}"`;
    case 'temperature_changed':
      return `Temperatura alterada para ${details.to_temperature}`;
    case 'assigned':
      return `Atribuído para ${details.to_user}`;
    case 'label_added':
      return `Etiqueta "${details.label_name}" adicionada`;
    case 'label_removed':
      return `Etiqueta "${details.label_name}" removida`;
    case 'note_added':
      return 'Nota adicionada';
    case 'updated':
      return 'Lead atualizado';
    default:
      return action;
  }
}
