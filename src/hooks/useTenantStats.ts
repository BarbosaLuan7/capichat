import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TenantStats {
  tenantId: string;
  totalLeads: number;
  openConversations: number;
  resolvedConversations: number;
  resolutionRate: number;
}

export function useTenantStats(tenantIds: string[]) {
  return useQuery({
    queryKey: ['tenant-stats', tenantIds],
    queryFn: async (): Promise<Record<string, TenantStats>> => {
      if (!tenantIds.length) return {};

      const statsPromises = tenantIds.map(async (tenantId) => {
        // Fetch leads count for this tenant
        const { count: leadsCount } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        // Fetch lead IDs for this tenant to get conversations
        const { data: leads } = await supabase
          .from('leads')
          .select('id')
          .eq('tenant_id', tenantId);

        const leadIds = leads?.map(l => l.id) || [];

        let openConversations = 0;
        let resolvedConversations = 0;

        if (leadIds.length > 0) {
          // Fetch conversations for these leads
          const { data: conversations } = await supabase
            .from('conversations')
            .select('status')
            .in('lead_id', leadIds);

          if (conversations) {
            openConversations = conversations.filter(c => c.status === 'open').length;
            resolvedConversations = conversations.filter(c => c.status === 'resolved').length;
          }
        }

        const totalConversations = openConversations + resolvedConversations;
        const resolutionRate = totalConversations > 0 
          ? Math.round((resolvedConversations / totalConversations) * 100) 
          : 0;

        return {
          tenantId,
          totalLeads: leadsCount || 0,
          openConversations,
          resolvedConversations,
          resolutionRate,
        };
      });

      const statsArray = await Promise.all(statsPromises);
      
      return statsArray.reduce((acc, stat) => {
        acc[stat.tenantId] = stat;
        return acc;
      }, {} as Record<string, TenantStats>);
    },
    enabled: tenantIds.length > 0,
    staleTime: 30000, // 30 seconds
  });
}
