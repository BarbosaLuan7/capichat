import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AutomationLog {
  id: string;
  automation_id: string;
  trigger_event: string;
  payload: Record<string, unknown>;
  conditions_evaluated: Array<{
    field: string;
    operator: string;
    value: string;
    result: boolean;
  }>;
  conditions_met: boolean;
  actions_executed: Array<{
    type: string;
    params: Record<string, string>;
    success: boolean;
    error?: string;
  }>;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export function useAutomationLogs(automationId?: string, limit = 50) {
  return useQuery({
    queryKey: ['automation-logs', automationId, limit],
    queryFn: async () => {
      let query = supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (automationId) {
        query = query.eq('automation_id', automationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as AutomationLog[];
    },
  });
}

export function useRecentAutomationLogs(limit = 20) {
  return useQuery({
    queryKey: ['automation-logs-recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_logs')
        .select(`
          *,
          automations:automation_id (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as unknown as (AutomationLog & { automations: { name: string } | null })[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useAutomationStats() {
  return useQuery({
    queryKey: ['automation-stats'],
    queryFn: async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get stats for last 24h
      const { data: last24hData, error: error24h } = await supabase
        .from('automation_logs')
        .select('status')
        .gte('created_at', last24h);

      if (error24h) throw error24h;

      // Get stats for last 7 days
      const { data: last7dData, error: error7d } = await supabase
        .from('automation_logs')
        .select('status')
        .gte('created_at', last7d);

      if (error7d) throw error7d;

      const countByStatus = (data: { status: string }[]) => ({
        total: data.length,
        success: data.filter(d => d.status === 'success').length,
        failed: data.filter(d => d.status === 'failed').length,
        skipped: data.filter(d => d.status === 'skipped').length,
      });

      return {
        last24h: countByStatus(last24hData || []),
        last7d: countByStatus(last7dData || []),
      };
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
