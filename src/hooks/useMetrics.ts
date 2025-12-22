import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format, differenceInMinutes } from 'date-fns';

export type PeriodFilter = 'today' | 'week' | 'month' | 'quarter';

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

// Hook para buscar métricas de leads
export function useLeadMetrics(period: PeriodFilter) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['lead-metrics', period],
    queryFn: async () => {
      // Total de leads no período
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, created_at, temperature, stage_id, assigned_to')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (leadsError) throw leadsError;

      // Leads por fonte (via labels de origem)
      const { data: leadLabels, error: labelsError } = await supabase
        .from('lead_labels')
        .select(`
          lead_id,
          labels!inner(name, category, color)
        `)
        .eq('labels.category', 'origem');

      if (labelsError) throw labelsError;

      // Contar leads por origem
      const leadsBySource: Record<string, { count: number; color: string }> = {};
      leadLabels?.forEach((ll: any) => {
        const sourceName = ll.labels?.name;
        const color = ll.labels?.color || '#6B7280';
        if (sourceName) {
          if (!leadsBySource[sourceName]) {
            leadsBySource[sourceName] = { count: 0, color };
          }
          leadsBySource[sourceName].count++;
        }
      });

      const sourceData = Object.entries(leadsBySource)
        .map(([name, data]) => ({
          name,
          value: data.count,
          color: data.color,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      return {
        totalLeads: leads?.length || 0,
        leadsByTemperature: {
          cold: leads?.filter(l => l.temperature === 'cold').length || 0,
          warm: leads?.filter(l => l.temperature === 'warm').length || 0,
          hot: leads?.filter(l => l.temperature === 'hot').length || 0,
        },
        leadsBySource: sourceData,
        rawLeads: leads || [],
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook para métricas do funil
export function useFunnelMetrics(period: PeriodFilter) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['funnel-metrics', period],
    queryFn: async () => {
      // Buscar etapas do funil
      const { data: stages, error: stagesError } = await supabase
        .from('funnel_stages')
        .select('id, name, color, grupo, order')
        .order('order');

      if (stagesError) throw stagesError;

      // Buscar leads por etapa
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, stage_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

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

      // Calcular taxas de conversão entre etapas
      const conversionRates = funnelData.map((stage, index) => {
        if (index === 0) return { ...stage, conversionRate: 100 };
        const previousCount = funnelData[0].count;
        const rate = previousCount > 0 ? (stage.count / previousCount) * 100 : 0;
        return { ...stage, conversionRate: parseFloat(rate.toFixed(1)) };
      });

      return {
        stages: conversionRates,
        totalInFunnel: leads?.length || 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook para performance por atendente
export function useAgentPerformance(period: PeriodFilter) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['agent-performance', period],
    queryFn: async () => {
      // Buscar perfis
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar, email');

      if (profilesError) throw profilesError;

      // Buscar leads atribuídos
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, assigned_to, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (leadsError) throw leadsError;

      // Buscar conversas
      const { data: conversations, error: convsError } = await supabase
        .from('conversations')
        .select('id, assigned_to, status, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (convsError) throw convsError;

      // Buscar mensagens para calcular tempo de resposta
      const { data: messages, error: msgsError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_type, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

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
              if (diff >= 0 && diff < 1440) { // Ignora respostas após 24h
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
    staleTime: 1000 * 60 * 5,
  });
}

// Hook para evolução diária
export function useDailyEvolution(period: PeriodFilter) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['daily-evolution', period],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

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
    staleTime: 1000 * 60 * 5,
  });
}

// Hook para métricas de conversas
export function useConversationMetrics(period: PeriodFilter) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['conversation-metrics', period],
    queryFn: async () => {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, status, created_at, last_message_at, unread_count')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      const open = conversations?.filter(c => c.status === 'open').length || 0;
      const pending = conversations?.filter(c => c.status === 'pending').length || 0;
      const resolved = conversations?.filter(c => c.status === 'resolved').length || 0;
      const total = conversations?.length || 0;

      return {
        total,
        open,
        pending,
        resolved,
        resolutionRate: total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
