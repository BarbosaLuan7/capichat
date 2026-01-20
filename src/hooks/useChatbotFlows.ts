import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FlowNode {
  id: string;
  type: 'trigger' | 'wait' | 'message' | 'add_label' | 'remove_label' | 'condition' | 'move_stage';
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface FlowConnection {
  from: string;
  to: string;
  label?: string;
}

export interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  nodes: FlowNode[];
  connections: FlowConnection[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useChatbotFlows() {
  return useQuery({
    queryKey: ['chatbot-flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((flow) => ({
        ...flow,
        nodes: (flow.nodes as unknown as FlowNode[]) || [],
        connections: (flow.connections as unknown as FlowConnection[]) || [],
      })) as ChatbotFlow[];
    },
  });
}

export function useChatbotFlow(id: string | null) {
  return useQuery({
    queryKey: ['chatbot-flow', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        nodes: (data.nodes as unknown as FlowNode[]) || [],
        connections: (data.connections as unknown as FlowConnection[]) || [],
      } as ChatbotFlow;
    },
    enabled: !!id,
  });
}

export function useCreateChatbotFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flow: {
      name: string;
      description?: string;
      nodes: FlowNode[];
      connections: FlowConnection[];
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('chatbot_flows')
        .insert([
          {
            name: flow.name,
            description: flow.description,
            nodes: JSON.parse(JSON.stringify(flow.nodes)),
            connections: JSON.parse(JSON.stringify(flow.connections)),
            created_by: user.user?.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success('Fluxo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar fluxo: ${error.message}`);
    },
  });
}

export function useUpdateChatbotFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...flow }: Partial<ChatbotFlow> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (flow.name !== undefined) updateData.name = flow.name;
      if (flow.description !== undefined) updateData.description = flow.description;
      if (flow.nodes !== undefined) updateData.nodes = flow.nodes;
      if (flow.connections !== undefined) updateData.connections = flow.connections;
      if (flow.is_active !== undefined) updateData.is_active = flow.is_active;

      const { data, error } = await supabase
        .from('chatbot_flows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      queryClient.invalidateQueries({ queryKey: ['chatbot-flow', variables.id] });
      toast.success('Fluxo atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar fluxo: ${error.message}`);
    },
  });
}

export function useDeleteChatbotFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chatbot_flows').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success('Fluxo removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover fluxo: ${error.message}`);
    },
  });
}

export function useToggleChatbotFlowActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success(data.is_active ? 'Fluxo ativado' : 'Fluxo desativado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao alterar status: ${error.message}`);
    },
  });
}
