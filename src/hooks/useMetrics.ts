import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format, differenceInMinutes } from 'date-fns';

export type PeriodFilter = 'today' | 'week' | 'month' | 'quarter';

export interface MetricsFilters {
  period: PeriodFilter;
  tenantId?: string | null;
}

function getDateRange(period: PeriodFilter) {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      return { start: subDays(now, 90), end: now };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

// Helper to get the previous period dates for comparison
function getPreviousPeriodDates(period: PeriodFilter) {
  const { start, end } = getDateRange(period);
  const duration = end.getTime() - start.getTime();
  
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1), // 1ms before current period starts
  };
}

// Hook para buscar métricas de leads
export function useLeadMetrics(period: PeriodFilter, tenantId?: string | null) {
  const { start, end } = getDateRange(period);
  const previousPeriod = getPreviousPeriodDates(period);

  return useQuery({
    queryKey: ['lead-metrics', period, tenantId],
    queryFn: async () => {
      // Build query with optional tenant filter
      let query = supabase
        .from('leads')
        .select('id, created_at, temperature, stage_id, assigned_to, tenant_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: leads, error: leadsError } = await query;

      if (leadsError) throw leadsError;

      // Previous period query
      let prevQuery = supabase
        .from('leads')
        .select('id')
        .gte('created_at', previousPeriod.start.toISOString())
        .lte('created_at', previousPeriod.end.toISOString());

      if (tenantId) {
        prevQuery = prevQuery.eq('tenant_id', tenantId);
      }

      const { data: previousLeads, error: previousError } = await prevQuery;

      if (previousError) throw previousError;

      const currentCount = leads?.length || 0;
      const previousCount = previousLeads?.length || 0;
      
      // Calcular variação percentual
      let changePercent = 0;
      if (previousCount > 0) {
        changePercent = ((currentCount - previousCount) / previousCount) * 100;
      } else if (currentCount > 0) {
        changePercent = 100;
      }

      // Leads por fonte (via labels de origem)
      const leadIds = leads?.map(l => l.id) || [];
      
      let leadsBySource: { name: string; value: number; color: string }[] = [];
      
      if (leadIds.length > 0) {
        const { data: leadLabels, error: labelsError } = await supabase
          .from('lead_labels')
          .select(`
            lead_id,
            labels!inner(name, category, color)
          `)
          .eq('labels.category', 'origem')
          .in('lead_id', leadIds);

        if (labelsError) throw labelsError;

        // Contar leads por origem
        const sourceMap: Record<string, { count: number; color: string }> = {};
        leadLabels?.forEach((ll: any) => {
          const sourceName = ll.labels?.name;
          const color = ll.labels?.color || '#6B7280';
          if (sourceName) {
            if (!sourceMap[sourceName]) {
              sourceMap[sourceName] = { count: 0, color };
            }
            sourceMap[sourceName].count++;
          }
        });

        leadsBySource = Object.entries(sourceMap)
          .map(([name, data]) => ({
            name,
            value: data.count,
            color: data.color,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);
      }

      return {
        totalLeads: currentCount,
        previousPeriodLeads: previousCount,
        changePercent: parseFloat(changePercent.toFixed(1)),
        leadsByTemperature: {
          cold: leads?.filter(l => l.temperature === 'cold').length || 0,
          warm: leads?.filter(l => l.temperature === 'warm').length || 0,
          hot: leads?.filter(l => l.temperature === 'hot').length || 0,
        },
        leadsBySource,
        rawLeads: leads || [],
      };
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook para métricas do funil
export function useFunnelMetrics(period: PeriodFilter, tenantId?: string | null) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['funnel-metrics', period, tenantId],
    queryFn: async () => {
      // Buscar etapas do funil (filtrar por tenant se especificado)
      let stagesQuery = supabase
        .from('funnel_stages')
        .select('id, name, color, grupo, order')
        .order('order');

      if (tenantId) {
        stagesQuery = stagesQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      }

      const { data: stages, error: stagesError } = await stagesQuery;

      if (stagesError) throw stagesError;

      // Buscar leads por etapa
      let leadsQuery = supabase
        .from('leads')
        .select('id, stage_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (tenantId) {
        leadsQuery = leadsQuery.eq('tenant_id', tenantId);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) throw leadsError;

      // Contar leads por etapa
      const funnelData = stages?.map(stage => {
        const count = leads?.filter(l => l.stage_id === stage.id).length || 0;
        return {
          id: stage.id,
          stage: stage.name,
          color: stage.color,
          grupo: stage.grupo,
          count,
        };
      }) || [];

      // Calcular taxas de conversão
      const totalLeadsInFunnel = funnelData.reduce((sum, s) => sum + s.count, 0);
      const conversionRates = funnelData.map((stage) => {
        const rate = totalLeadsInFunnel > 0 ? (stage.count / totalLeadsInFunnel) * 100 : 0;
        return { ...stage, conversionRate: parseFloat(rate.toFixed(1)) };
      });

      return {
        stages: conversionRates,
        totalInFunnel: leads?.length || 0,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook para performance por atendente
export function useAgentPerformance(period: PeriodFilter, tenantId?: string | null) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['agent-performance', period, tenantId],
    queryFn: async () => {
      // Buscar perfis (se tenant especificado, filtrar por user_tenants)
      let profiles: any[] = [];
      
      if (tenantId) {
        const { data: userTenants, error: utError } = await supabase
          .from('user_tenants')
          .select(`
            user_id,
            profiles:user_id(id, name, avatar, email)
          `)
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

        if (utError) throw utError;
        profiles = userTenants?.map((ut: any) => ut.profiles).filter(Boolean) || [];
      } else {
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, avatar, email');

        if (profilesError) throw profilesError;
        profiles = allProfiles || [];
      }

      // Buscar leads atribuídos
      let leadsQuery = supabase
        .from('leads')
        .select('id, assigned_to, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (tenantId) {
        leadsQuery = leadsQuery.eq('tenant_id', tenantId);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) throw leadsError;

      // Get lead IDs to filter conversations
      const leadIds = leads?.map(l => l.id) || [];

      // Buscar conversas
      let conversationsQuery = supabase
        .from('conversations')
        .select('id, assigned_to, status, created_at, lead_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (tenantId && leadIds.length > 0) {
        conversationsQuery = conversationsQuery.in('lead_id', leadIds);
      }

      const { data: conversations, error: convsError } = await conversationsQuery;

      if (convsError) throw convsError;

      // Get conversation IDs
      const conversationIds = conversations?.map(c => c.id) || [];

      // Buscar mensagens para calcular tempo de resposta
      let messagesQuery = supabase
        .from('messages')
        .select('id, conversation_id, sender_type, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      if (conversationIds.length > 0) {
        messagesQuery = messagesQuery.in('conversation_id', conversationIds);
      }

      const { data: messages, error: msgsError } = await messagesQuery;

      if (msgsError) throw msgsError;

      // Calcular métricas por atendente
      const agentMetrics = profiles?.map(profile => {
        const agentLeads = leads?.filter(l => l.assigned_to === profile.id).length || 0;
        const agentConversations = conversations?.filter(c => c.assigned_to === profile.id) || [];
        const resolvedConversations = agentConversations.filter(c => c.status === 'resolved').length;
        
        // Calcular tempo médio de resposta
        let totalResponseTime = 0;
        let responseCount = 0;

        agentConversations.forEach(conv => {
          const convMessages = messages?.filter(m => m.conversation_id === conv.id) || [];
          for (let i = 1; i < convMessages.length; i++) {
            const prev = convMessages[i - 1];
            const curr = convMessages[i];
            if (prev.sender_type === 'lead' && curr.sender_type === 'agent') {
              const diff = differenceInMinutes(new Date(curr.created_at), new Date(prev.created_at));
              if (diff >= 0 && diff < 1440) {
                totalResponseTime += diff;
                responseCount++;
              }
            }
          }
        });

        const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;

        return {
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar,
          email: profile.email,
          leads: agentLeads,
          conversations: agentConversations.length,
          resolved: resolvedConversations,
          responseRate: agentConversations.length > 0 
            ? parseFloat(((resolvedConversations / agentConversations.length) * 100).toFixed(1))
            : 0,
          avgResponseTime: avgResponseTime,
          avgResponseTimeFormatted: avgResponseTime < 60 
            ? `${avgResponseTime}min` 
            : `${Math.floor(avgResponseTime / 60)}h ${avgResponseTime % 60}min`,
        };
      }).filter(a => a.leads > 0 || a.conversations > 0)
        .sort((a, b) => b.leads - a.leads) || [];

      return {
        agents: agentMetrics,
        totalAgents: agentMetrics.length,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook para evolução diária
export function useDailyEvolution(period: PeriodFilter, tenantId?: string | null) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['daily-evolution', period, tenantId],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: leads, error } = await query;

      if (error) throw error;

      // Agrupar por dia
      const dailyData: Record<string, number> = {};
      leads?.forEach(lead => {
        const day = format(new Date(lead.created_at), 'dd/MM');
        dailyData[day] = (dailyData[day] || 0) + 1;
      });

      const chartData = Object.entries(dailyData).map(([day, count]) => ({
        day,
        leads: count,
      }));

      return chartData;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook para métricas de conversas
export function useConversationMetrics(period: PeriodFilter, tenantId?: string | null) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['conversation-metrics', period, tenantId],
    queryFn: async () => {
      // Se temos tenant, precisamos filtrar via leads
      let conversations: any[] = [];

      if (tenantId) {
        // Buscar leads do tenant primeiro
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id')
          .eq('tenant_id', tenantId);

        if (leadsError) throw leadsError;

        const leadIds = leads?.map(l => l.id) || [];

        if (leadIds.length > 0) {
          const { data: convsData, error: convsError } = await supabase
            .from('conversations')
            .select('id, status, created_at, last_message_at, unread_count')
            .in('lead_id', leadIds)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

          if (convsError) throw convsError;
          conversations = convsData || [];
        }
      } else {
        const { data: convsData, error } = await supabase
          .from('conversations')
          .select('id, status, created_at, last_message_at, unread_count')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        if (error) throw error;
        conversations = convsData || [];
      }

      const open = conversations.filter(c => c.status === 'open').length;
      const pending = conversations.filter(c => c.status === 'pending').length;
      const resolved = conversations.filter(c => c.status === 'resolved').length;
      const total = conversations.length;

      return {
        total,
        open,
        pending,
        resolved,
        resolutionRate: total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 0,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
