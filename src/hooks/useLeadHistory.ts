import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadHistoryEntry {
  id: string;
  lead_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, any>;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

const fieldLabels: Record<string, string> = {
  name: 'Nome',
  phone: 'Telefone',
  email: 'E-mail',
  cpf: 'CPF',
  stage_id: 'Etapa do Funil',
  temperature: 'Temperatura',
  status: 'Status',
  assigned_to: 'Responsável',
  benefit_type: 'Tipo de Benefício',
  case_status: 'Status do Caso',
  lead: 'Lead',
};

export function getFieldLabel(fieldName: string): string {
  return fieldLabels[fieldName] || fieldName;
}

export function formatHistoryValue(fieldName: string, value: string | null): string {
  if (!value) return '-';
  
  if (fieldName === 'temperature') {
    const temps: Record<string, string> = { cold: 'Frio', warm: 'Morno', hot: 'Quente' };
    return temps[value] || value;
  }
  
  if (fieldName === 'status') {
    const statuses: Record<string, string> = { active: 'Ativo', archived: 'Arquivado', converted: 'Convertido', lost: 'Perdido' };
    return statuses[value] || value;
  }
  
  return value;
}

export function useLeadHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];

      const { data, error } = await supabase
        .from('lead_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user names for entries with user_id
      const userIds = [...new Set((data || []).filter(d => d.user_id).map(d => d.user_id))];
      let usersMap: Record<string, { id: string; name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        if (profiles) {
          usersMap = profiles.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, { id: string; name: string; email: string }>);
        }
      }

      // Fetch stage names for stage_id changes
      const stageIds = [...new Set((data || [])
        .filter(d => d.field_name === 'stage_id')
        .flatMap(d => [d.old_value, d.new_value])
        .filter(Boolean))];

      let stagesMap: Record<string, string> = {};
      if (stageIds.length > 0) {
        const { data: stages } = await supabase
          .from('funnel_stages')
          .select('id, name')
          .in('id', stageIds);

        if (stages) {
          stagesMap = stages.reduce((acc, s) => {
            acc[s.id] = s.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Fetch user names for assigned_to changes
      const assignedIds = [...new Set((data || [])
        .filter(d => d.field_name === 'assigned_to')
        .flatMap(d => [d.old_value, d.new_value])
        .filter(Boolean))];

      let assignedMap: Record<string, string> = {};
      if (assignedIds.length > 0) {
        const { data: assigned } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', assignedIds);

        if (assigned) {
          assignedMap = assigned.reduce((acc, a) => {
            acc[a.id] = a.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (data || []).map(entry => {
        let old_value = entry.old_value;
        let new_value = entry.new_value;

        // Replace stage IDs with names
        if (entry.field_name === 'stage_id') {
          if (old_value && stagesMap[old_value]) old_value = stagesMap[old_value];
          if (new_value && stagesMap[new_value]) new_value = stagesMap[new_value];
        }

        // Replace user IDs with names
        if (entry.field_name === 'assigned_to') {
          if (old_value && assignedMap[old_value]) old_value = assignedMap[old_value];
          if (new_value && assignedMap[new_value]) new_value = assignedMap[new_value];
        }

        return {
          ...entry,
          old_value,
          new_value,
          user: entry.user_id ? usersMap[entry.user_id] : undefined,
        };
      }) as LeadHistoryEntry[];
    },
    enabled: !!leadId,
  });
}
