-- Tabela de atividades do lead
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para performance
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created_at ON public.lead_activities(created_at DESC);

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view activities of leads they have access to"
ON public.lead_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activities.lead_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      leads.assigned_to = auth.uid()
    )
  )
);

CREATE POLICY "Users can create activities for leads they have access to"
ON public.lead_activities
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activities.lead_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      leads.assigned_to = auth.uid()
    )
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activities;