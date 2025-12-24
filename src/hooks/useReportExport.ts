import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format as formatDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

export type ReportType = 'leads' | 'conversations' | 'agents' | 'funnel' | 'full';
export type ReportFormat = 'csv' | 'xlsx';

type LeadStatus = Database['public']['Enums']['lead_status'];

interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  stageId?: string;
  agentId?: string;
  status?: LeadStatus;
}

export function useReportExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportLeadsReport = async (filters: ReportFilters, format: ReportFormat) => {
    let query = supabase
      .from('leads')
      .select(`
        id, name, phone, email, cpf, source, temperature, status, created_at, updated_at,
        stage:funnel_stages(name),
        assigned:profiles!leads_assigned_to_fkey(name)
      `);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }
    if (filters.stageId) {
      query = query.eq('stage_id', filters.stageId);
    }
    if (filters.agentId) {
      query = query.eq('assigned_to', filters.agentId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(lead => ({
      Nome: lead.name,
      Telefone: lead.phone,
      Email: lead.email || '',
      CPF: lead.cpf || '',
      Origem: lead.source,
      Etapa: (lead.stage as any)?.name || '',
      Responsável: (lead.assigned as any)?.name || '',
      Temperatura: lead.temperature === 'hot' ? 'Quente' : lead.temperature === 'warm' ? 'Morno' : 'Frio',
      Status: lead.status === 'active' ? 'Ativo' : lead.status === 'converted' ? 'Convertido' : lead.status === 'lost' ? 'Perdido' : 'Arquivado',
      'Data Criação': formatDate(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    }));
  };

  const exportConversationsReport = async (filters: ReportFilters, reportFormat: ReportFormat) => {
    let query = supabase
      .from('conversations')
      .select(`
        id, status, unread_count, created_at, last_message_at,
        lead:leads(name, phone),
        assigned:profiles!conversations_assigned_to_fkey(name)
      `);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(conv => ({
      Lead: (conv.lead as any)?.name || '',
      Telefone: (conv.lead as any)?.phone || '',
      Responsável: (conv.assigned as any)?.name || '',
      Status: conv.status === 'open' ? 'Aberta' : conv.status === 'pending' ? 'Pendente' : 'Resolvida',
      'Não Lidas': conv.unread_count,
      'Data Criação': formatDate(new Date(conv.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Última Mensagem': formatDate(new Date(conv.last_message_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    }));
  };

  const exportAgentsReport = async (filters: ReportFilters, reportFormat: ReportFormat) => {
    const { data: agents, error: agentsError } = await supabase
      .from('profiles')
      .select('id, name, email, is_active');

    if (agentsError) throw agentsError;

    const results = await Promise.all((agents || []).map(async (agent) => {
      const [leadsResult, convsResult] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact' }).eq('assigned_to', agent.id),
        supabase.from('conversations').select('id, status', { count: 'exact' }).eq('assigned_to', agent.id),
      ]);

      const resolved = (convsResult.data || []).filter(c => c.status === 'resolved').length;
      const total = convsResult.count || 0;

      return {
        Nome: agent.name,
        Email: agent.email,
        Status: agent.is_active ? 'Ativo' : 'Inativo',
        'Leads Atribuídos': leadsResult.count || 0,
        'Conversas Totais': total,
        'Conversas Resolvidas': resolved,
        'Taxa de Resolução': total > 0 ? `${Math.round((resolved / total) * 100)}%` : '0%',
      };
    }));

    return results;
  };

  const exportFunnelReport = async (filters: ReportFilters, reportFormat: ReportFormat) => {
    const { data: stages, error: stagesError } = await supabase
      .from('funnel_stages')
      .select('id, name, grupo')
      .order('order');

    if (stagesError) throw stagesError;

    const results = await Promise.all((stages || []).map(async (stage) => {
      let query = supabase.from('leads').select('id', { count: 'exact' }).eq('stage_id', stage.id);

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      const { count } = await query;

      return {
        Etapa: stage.name,
        Grupo: stage.grupo || '',
        'Quantidade de Leads': count || 0,
      };
    }));

    return results;
  };

  const convertToCSV = (data: Record<string, any>[]) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(';'),
      ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';')),
    ];
    
    return '\ufeff' + csvRows.join('\n'); // BOM for Excel UTF-8
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportReport = async (type: ReportType, reportFormat: ReportFormat, filters: ReportFilters = {}) => {
    setIsExporting(true);
    try {
      let data: Record<string, any>[] = [];
      const dateStr = formatDate(new Date(), 'yyyy-MM-dd');

      switch (type) {
        case 'leads':
          data = await exportLeadsReport(filters, reportFormat);
          break;
        case 'conversations':
          data = await exportConversationsReport(filters, reportFormat);
          break;
        case 'agents':
          data = await exportAgentsReport(filters, reportFormat);
          break;
        case 'funnel':
          data = await exportFunnelReport(filters, reportFormat);
          break;
        case 'full':
          // For full report, combine all
          const [leads, convs, agents, funnel] = await Promise.all([
            exportLeadsReport(filters, reportFormat),
            exportConversationsReport(filters, reportFormat),
            exportAgentsReport(filters, reportFormat),
            exportFunnelReport(filters, reportFormat),
          ]);
          // Export each as separate file
          downloadFile(convertToCSV(leads), `leads_${dateStr}.csv`, 'text/csv;charset=utf-8');
          downloadFile(convertToCSV(convs), `conversas_${dateStr}.csv`, 'text/csv;charset=utf-8');
          downloadFile(convertToCSV(agents), `agentes_${dateStr}.csv`, 'text/csv;charset=utf-8');
          downloadFile(convertToCSV(funnel), `funil_${dateStr}.csv`, 'text/csv;charset=utf-8');
          toast({ title: 'Relatórios exportados com sucesso' });
          return;
      }

      const filename = `${type}_${dateStr}.csv`;
      downloadFile(convertToCSV(data), filename, 'text/csv;charset=utf-8');
      toast({ title: 'Relatório exportado com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return { exportReport, isExporting };
}
