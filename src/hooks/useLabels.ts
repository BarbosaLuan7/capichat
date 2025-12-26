import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Label = Database['public']['Tables']['labels']['Row'];
type LabelInsert = Database['public']['Tables']['labels']['Insert'];
type LabelUpdate = Database['public']['Tables']['labels']['Update'];

export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Label[];
    },
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label: LabelInsert) => {
      const { data, error } = await supabase
        .from('labels')
        .insert(label)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LabelUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('labels')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useLeadLabels(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead_labels', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_labels')
        .select(`
          *,
          labels (id, name, color, category)
        `)
        .eq('lead_id', leadId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });
}

export function useAddLeadLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, labelId }: { leadId: string; labelId: string }) => {
      const { data, error } = await supabase
        .from('lead_labels')
        .insert({ lead_id: leadId, label_id: labelId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_labels', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useRemoveLeadLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, labelId }: { leadId: string; labelId: string }) => {
      const { error } = await supabase
        .from('lead_labels')
        .delete()
        .eq('lead_id', leadId)
        .eq('label_id', labelId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_labels', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
