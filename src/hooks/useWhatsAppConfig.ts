import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Safe version from whatsapp_config_safe VIEW (masks sensitive data)
export interface WhatsAppConfig {
  id: string;
  name: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key_masked: string | null; // Shows only last 4 chars
  instance_name: string | null;
  phone_number: string | null;
  is_active: boolean;
  has_webhook_secret: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
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
      // Use the secure view that masks sensitive data
      // Using rpc call since the view is not in generated types
      const { data, error } = await supabase
        .rpc('get_whatsapp_configs_safe' as any)
        .order('created_at', { ascending: false });

      // Fallback to original table if RPC doesn't exist yet
      if (error && error.code === '42883') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('whatsapp_config')
          .select('id, name, provider, base_url, instance_name, phone_number, is_active, created_by, created_at, updated_at, tenant_id')
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        
        // Mask the api_key in the response
        return (fallbackData || []).map(config => ({
          ...config,
          api_key_masked: null,
          has_webhook_secret: false,
        })) as WhatsAppConfig[];
      }

      if (error) throw error;
      return data as WhatsAppConfig[];
    },
  });
}

// For creating configs, we still use the real table (admin only)
export function useCreateWhatsAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: WhatsAppConfigInsert) => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .insert(config)
        .select('id, name, provider, is_active')
        .single();

      if (error) throw error;
      return data;
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

// For updating configs - only update fields that are provided
export function useUpdateWhatsAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...config }: Partial<WhatsAppConfigInsert> & { id: string }) => {
      // Filter out undefined/empty values to avoid overwriting with nulls
      const updateData: Record<string, unknown> = {};
      Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          updateData[key] = value;
        }
      });

      const { data, error } = await supabase
        .from('whatsapp_config')
        .update(updateData)
        .eq('id', id)
        .select('id, name, provider, is_active')
        .single();

      if (error) throw error;
      return data;
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
