-- Create automation_logs table for execution history
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  conditions_evaluated JSONB DEFAULT '[]',
  conditions_met BOOLEAN NOT NULL DEFAULT false,
  actions_executed JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_automation_logs_automation_id ON public.automation_logs(automation_id);
CREATE INDEX idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
CREATE INDEX idx_automation_logs_status ON public.automation_logs(status);

-- RLS policies
CREATE POLICY "Admins can view all automation logs"
ON public.automation_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view automation logs"
ON public.automation_logs FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_logs;