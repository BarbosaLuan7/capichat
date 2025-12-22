import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WhatsAppConfig {
  id: string;
  name: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name: string | null;
  phone_number: string | null;
  is_active: boolean;
  webhook_secret: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConfigInsert {
  name: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name?: string;
  phone_number?: string;
  is_active?: boolean;
}

export function useWhatsAppConfigs() {
  return useQuery({
    queryKey: ['whatsapp-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WhatsAppConfig[];
    },
  });
}

export function useCreateWhatsAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: WhatsAppConfigInsert) => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      toast({ title: 'Gateway WhatsApp criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao criar gateway', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useUpdateWhatsAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...config }: Partial<WhatsAppConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .update(config)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      toast({ title: 'Gateway WhatsApp atualizado' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao atualizar gateway', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useDeleteWhatsAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      toast({ title: 'Gateway WhatsApp removido' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover gateway', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useTestWhatsAppConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: { 
      provider: string; 
      base_url: string; 
      api_key: string; 
      instance_name?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-test-connection', {
        body: config,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data as { success: boolean; status?: string; phone?: string; engine?: string };
    },
    onSuccess: (data) => {
      const parts = [
        data.phone ? `Conectado ao número: ${data.phone}` : (data.status ? `Status: ${data.status}` : ''),
        data.engine ? `Engine: ${String(data.engine).toUpperCase()}` : '',
      ].filter(Boolean);

      toast({ 
        title: 'Conexão bem sucedida!', 
        description: parts.join(' • '),
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Falha na conexão', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
