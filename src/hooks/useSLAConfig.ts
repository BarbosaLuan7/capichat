import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SLAConfig {
  id: string;
  stage_id: string;
  max_hours: number;
  warning_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stage?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface LeadWithSLA {
  id: string;
  name: string;
  phone: string;
  stage_id: string;
  last_interaction_at: string | null;
  created_at: string;
  sla_status: 'ok' | 'warning' | 'exceeded';
  hours_in_stage: number;
  sla_config?: SLAConfig;
}

export function useSLAConfigs() {
  return useQuery({
    queryKey: ['sla-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sla_configs')
        .select(`
          *,
          stage:funnel_stages(id, name, color)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as SLAConfig[];
    },
  });
}

export function useUpsertSLAConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: { stage_id: string; max_hours: number; warning_hours: number; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('sla_configs')
        .upsert({
          stage_id: config.stage_id,
          max_hours: config.max_hours,
          warning_hours: config.warning_hours,
          is_active: config.is_active ?? true,
        }, { onConflict: 'stage_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
      queryClient.invalidateQueries({ queryKey: ['leads-with-sla'] });
      toast({ title: 'Configuração de SLA salva' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar SLA', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteSLAConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sla_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
      toast({ title: 'Configuração de SLA removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover SLA', description: error.message, variant: 'destructive' });
    },
  });
}

export function useLeadsWithSLAStatus() {
  const { data: slaConfigs } = useSLAConfigs();

  return useQuery({
    queryKey: ['leads-with-sla', slaConfigs?.map(s => s.id)],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, name, phone, stage_id, last_interaction_at, created_at')
        .eq('status', 'active')
        .not('stage_id', 'is', null);

      if (error) throw error;

      const now = new Date();
      const leadsWithSLA: LeadWithSLA[] = (leads || []).map(lead => {
        const slaConfig = slaConfigs?.find(s => s.stage_id === lead.stage_id);
        const lastInteraction = lead.last_interaction_at ? new Date(lead.last_interaction_at) : new Date(lead.created_at);
        const hoursInStage = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60));

        let sla_status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (slaConfig && slaConfig.is_active) {
          if (hoursInStage >= slaConfig.max_hours) {
            sla_status = 'exceeded';
          } else if (hoursInStage >= slaConfig.warning_hours) {
            sla_status = 'warning';
          }
        }

        return {
          ...lead,
          sla_status,
          hours_in_stage: hoursInStage,
          sla_config: slaConfig,
        };
      });

      return leadsWithSLA;
    },
    enabled: !!slaConfigs,
  });
}

export function useSLAAlerts() {
  const { data: leadsWithSLA } = useLeadsWithSLAStatus();

  const warnings = leadsWithSLA?.filter(l => l.sla_status === 'warning') || [];
  const exceeded = leadsWithSLA?.filter(l => l.sla_status === 'exceeded') || [];

  return {
    warnings,
    exceeded,
    totalAlerts: warnings.length + exceeded.length,
    hasAlerts: warnings.length > 0 || exceeded.length > 0,
  };
}
