-- Tabela para fluxos do chatbot
CREATE TABLE public.chatbot_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para mensagens agendadas
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para configurações de SLA
CREATE TABLE public.sla_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  max_hours INTEGER NOT NULL DEFAULT 24,
  warning_hours INTEGER NOT NULL DEFAULT 12,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stage_id)
);

-- Tabela para histórico de alterações de leads
CREATE TABLE public.lead_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para relatórios agendados
CREATE TABLE public.scheduled_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('leads', 'conversations', 'agents', 'funnel', 'full')),
  format TEXT NOT NULL DEFAULT 'xlsx' CHECK (format IN ('xlsx', 'pdf', 'csv')),
  filters JSONB DEFAULT '{}'::jsonb,
  schedule_cron TEXT,
  recipients TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_scheduled_messages_scheduled_for ON public.scheduled_messages(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_messages_lead ON public.scheduled_messages(lead_id);
CREATE INDEX idx_lead_history_lead ON public.lead_history(lead_id);
CREATE INDEX idx_lead_history_created ON public.lead_history(created_at DESC);
CREATE INDEX idx_sla_configs_stage ON public.sla_configs(stage_id);

-- Habilitar RLS
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para chatbot_flows
CREATE POLICY "Admins can manage chatbot flows" ON public.chatbot_flows
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active flows" ON public.chatbot_flows
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Políticas RLS para scheduled_messages
CREATE POLICY "Users can manage scheduled messages for their leads" ON public.scheduled_messages
  FOR ALL USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM leads WHERE leads.id = scheduled_messages.lead_id AND leads.assigned_to = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    created_by = auth.uid()
  );

-- Políticas RLS para sla_configs
CREATE POLICY "Admins can manage SLA configs" ON public.sla_configs
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view SLA configs" ON public.sla_configs
  FOR SELECT USING (true);

-- Políticas RLS para lead_history
CREATE POLICY "Users can view history of leads they have access to" ON public.lead_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_history.lead_id 
      AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR leads.assigned_to = auth.uid())
    )
  );

CREATE POLICY "System can insert lead history" ON public.lead_history
  FOR INSERT WITH CHECK (true);

-- Políticas RLS para scheduled_reports
CREATE POLICY "Admins and managers can manage reports" ON public.scheduled_reports
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_chatbot_flows_updated_at
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sla_configs_updated_at
  BEFORE UPDATE ON public.sla_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para registrar histórico de alterações em leads
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes_made BOOLEAN := false;
  field_names TEXT[] := ARRAY['name', 'phone', 'email', 'cpf', 'stage_id', 'temperature', 'status', 'assigned_to', 'benefit_type', 'case_status'];
  field_name TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOREACH field_name IN ARRAY field_names LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', field_name, field_name) 
        INTO old_val, new_val USING OLD, NEW;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO public.lead_history (lead_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'update', field_name, old_val, new_val);
        changes_made := true;
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_history (lead_id, user_id, action, field_name, new_value)
    VALUES (NEW.id, auth.uid(), 'create', 'lead', NEW.name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para log de alterações
CREATE TRIGGER log_lead_changes_trigger
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_changes();

-- Habilitar realtime para mensagens agendadas
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;