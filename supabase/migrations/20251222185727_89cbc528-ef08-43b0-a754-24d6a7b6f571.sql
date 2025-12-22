-- Criar tabela para configuração de gateways WhatsApp
CREATE TABLE public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('waha', 'evolution', 'z-api', 'custom')),
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT,
  phone_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  webhook_secret TEXT DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_whatsapp_config_is_active ON public.whatsapp_config(is_active);
CREATE INDEX idx_whatsapp_config_provider ON public.whatsapp_config(provider);

-- Habilitar RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Policies - apenas admins podem gerenciar
CREATE POLICY "Admins can manage whatsapp config"
  ON public.whatsapp_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Managers podem visualizar
CREATE POLICY "Managers can view whatsapp config"
  ON public.whatsapp_config
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();