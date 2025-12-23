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
      
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately for activities with user_id
      const activitiesWithProfiles = await Promise.all(
        data.map(async (activity) => {
          if (activity.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, name, avatar')
              .eq('id', activity.user_id)
              .single();
            return { ...activity, profiles: profile, details: activity.details as Record<string, any> };
          }
          return { ...activity, profiles: null, details: activity.details as Record<string, any> };
        })
      );
      
      return activitiesWithProfiles;
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
      return details.content 
        ? `Nota: "${details.content}"` 
        : 'Nota adicionada';
    case 'updated':
      return 'Lead atualizado';
    default:
      return action;
  }
}
