
-- =============================================
-- FASE 1: ESTRUTURA DE BANCO DE DADOS PARA PRODUÇÃO
-- =============================================

-- 1. ENUM para tipos de eventos de webhook
CREATE TYPE public.webhook_event AS ENUM (
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'lead.stage_changed',
  'lead.assigned',
  'lead.temperature_changed',
  'lead.label_added',
  'lead.label_removed',
  'message.received',
  'message.sent',
  'conversation.created',
  'conversation.assigned',
  'conversation.resolved',
  'task.created',
  'task.completed'
);

-- 2. ENUM para status de webhook log
CREATE TYPE public.webhook_log_status AS ENUM (
  'pending',
  'success',
  'failed',
  'retrying'
);

-- 3. ENUM para tipos de notificação
CREATE TYPE public.notification_type AS ENUM (
  'info',
  'success',
  'warning',
  'error',
  'message',
  'task',
  'lead'
);

-- 4. ENUM para status de lead
CREATE TYPE public.lead_status AS ENUM (
  'active',
  'archived',
  'converted',
  'lost'
);

-- 5. ENUM para direção de mensagem
CREATE TYPE public.message_direction AS ENUM (
  'inbound',
  'outbound'
);

-- =============================================
-- TABELA: webhooks
-- =============================================
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events webhook_event[] NOT NULL DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: webhook_logs
-- =============================================
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event webhook_event NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  status webhook_log_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- TABELA: api_keys
-- =============================================
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  rate_limit INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: notifications
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}',
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ADICIONAR CAMPOS FALTANTES EM leads
-- =============================================
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS benefit_type TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS nit_pis TEXT,
ADD COLUMN IF NOT EXISTS status lead_status NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS documents_checklist JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS case_status TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- =============================================
-- ADICIONAR CAMPOS FALTANTES EM messages
-- =============================================
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS direction message_direction,
ADD COLUMN IF NOT EXISTS is_internal_note BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_id UUID;

-- Atualizar direction baseado em sender_type existente
UPDATE public.messages 
SET direction = CASE 
  WHEN sender_type = 'lead' THEN 'inbound'::message_direction 
  ELSE 'outbound'::message_direction 
END
WHERE direction IS NULL;

-- =============================================
-- ÍNDICES DE PERFORMANCE
-- =============================================

-- Índices para leads
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_benefit_type ON public.leads(benefit_type);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON public.messages(lead_id);

-- Índices para lead_labels
CREATE INDEX IF NOT EXISTS idx_lead_labels_lead_id ON public.lead_labels(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_labels_label_id ON public.lead_labels(label_id);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

-- Índices para tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Índices para webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON public.webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON public.webhooks USING GIN(events);

-- Índices para webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON public.webhook_logs(event);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON public.webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Índices para api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active);

-- =============================================
-- TRIGGERS PARA updated_at
-- =============================================

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- RLS para webhooks
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhooks"
  ON public.webhooks FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view webhooks"
  ON public.webhooks FOR SELECT
  USING (has_role(auth.uid(), 'manager'));

-- RLS para webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage webhook logs"
  ON public.webhook_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS para api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage API keys"
  ON public.api_keys FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- =============================================
-- HABILITAR REALTIME NAS NOVAS TABELAS
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;

-- =============================================
-- FUNÇÃO AUXILIAR PARA VALIDAR API KEY
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_api_key(key_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  api_key_id UUID;
  key_hash_value TEXT;
BEGIN
  -- Gerar hash da key
  key_hash_value := encode(sha256(key_value::bytea), 'hex');
  
  -- Buscar key ativa
  SELECT id INTO api_key_id
  FROM public.api_keys
  WHERE key_hash = key_hash_value
    AND is_active = true;
  
  -- Atualizar last_used_at e usage_count
  IF api_key_id IS NOT NULL THEN
    UPDATE public.api_keys
    SET last_used_at = now(),
        usage_count = usage_count + 1
    WHERE id = api_key_id;
  END IF;
  
  RETURN api_key_id;
END;
$$;

-- =============================================
-- FUNÇÃO PARA CRIAR NOTIFICAÇÃO
-- =============================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type notification_type DEFAULT 'info',
  p_data JSONB DEFAULT '{}',
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, data, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_data, p_link)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;
