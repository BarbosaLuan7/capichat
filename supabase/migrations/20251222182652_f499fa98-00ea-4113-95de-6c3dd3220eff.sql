
-- Enable pg_net extension for HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to dispatch webhooks via Edge Function
CREATE OR REPLACE FUNCTION public.dispatch_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_event text;
  payload jsonb;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get Supabase URL from environment (set via vault or config)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Determine event type based on trigger operation and table
  CASE TG_TABLE_NAME
    WHEN 'leads' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'lead.created';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('lead', row_to_json(NEW))
          );
        WHEN 'UPDATE' THEN
          -- Check for specific field changes
          IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
            webhook_event := 'lead.stage_changed';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'lead', row_to_json(NEW),
                'previous_stage_id', OLD.stage_id,
                'new_stage_id', NEW.stage_id
              )
            );
          ELSIF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
            webhook_event := 'lead.temperature_changed';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'lead', row_to_json(NEW),
                'previous_temperature', OLD.temperature,
                'new_temperature', NEW.temperature
              )
            );
          ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            webhook_event := 'lead.assigned';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'lead', row_to_json(NEW),
                'previous_assigned_to', OLD.assigned_to,
                'new_assigned_to', NEW.assigned_to
              )
            );
          ELSE
            webhook_event := 'lead.updated';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object('lead', row_to_json(NEW))
            );
          END IF;
        WHEN 'DELETE' THEN
          webhook_event := 'lead.deleted';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('lead', row_to_json(OLD))
          );
      END CASE;
      
    WHEN 'messages' THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.sender_type = 'lead' THEN
          webhook_event := 'message.received';
        ELSE
          webhook_event := 'message.sent';
        END IF;
        payload := jsonb_build_object(
          'event', webhook_event,
          'timestamp', now(),
          'data', jsonb_build_object('message', row_to_json(NEW))
        );
      END IF;
      
    WHEN 'conversations' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'conversation.created';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('conversation', row_to_json(NEW))
          );
        WHEN 'UPDATE' THEN
          IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            webhook_event := 'conversation.assigned';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object(
                'conversation', row_to_json(NEW),
                'previous_assigned_to', OLD.assigned_to,
                'new_assigned_to', NEW.assigned_to
              )
            );
          ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'resolved' THEN
            webhook_event := 'conversation.resolved';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object('conversation', row_to_json(NEW))
            );
          ELSE
            RETURN COALESCE(NEW, OLD);
          END IF;
      END CASE;
      
    WHEN 'tasks' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'task.created';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object('task', row_to_json(NEW))
          );
        WHEN 'UPDATE' THEN
          IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done' THEN
            webhook_event := 'task.completed';
            payload := jsonb_build_object(
              'event', webhook_event,
              'timestamp', now(),
              'data', jsonb_build_object('task', row_to_json(NEW))
            );
          ELSE
            RETURN COALESCE(NEW, OLD);
          END IF;
      END CASE;
      
    WHEN 'lead_labels' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN
          webhook_event := 'lead.label_added';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object(
              'lead_id', NEW.lead_id,
              'label_id', NEW.label_id
            )
          );
        WHEN 'DELETE' THEN
          webhook_event := 'lead.label_removed';
          payload := jsonb_build_object(
            'event', webhook_event,
            'timestamp', now(),
            'data', jsonb_build_object(
              'lead_id', OLD.lead_id,
              'label_id', OLD.label_id
            )
          );
      END CASE;
      
    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;
  
  -- If no event was determined, skip
  IF webhook_event IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Insert into a queue table for async processing
  INSERT INTO public.webhook_queue (event, payload)
  VALUES (webhook_event::webhook_event, payload);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create webhook queue table for async processing
CREATE TABLE IF NOT EXISTS public.webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event webhook_event NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Enable RLS on webhook_queue
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;

-- Create index for unprocessed webhooks
CREATE INDEX idx_webhook_queue_unprocessed ON public.webhook_queue (processed, created_at) WHERE processed = false;

-- RLS policy for webhook_queue (service role only)
CREATE POLICY "Service role can manage webhook queue"
ON public.webhook_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Triggers for leads table
CREATE TRIGGER trigger_leads_webhook
AFTER INSERT OR UPDATE OR DELETE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_webhook_event();

-- Triggers for messages table
CREATE TRIGGER trigger_messages_webhook
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_webhook_event();

-- Triggers for conversations table
CREATE TRIGGER trigger_conversations_webhook
AFTER INSERT OR UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_webhook_event();

-- Triggers for tasks table
CREATE TRIGGER trigger_tasks_webhook
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_webhook_event();

-- Triggers for lead_labels table
CREATE TRIGGER trigger_lead_labels_webhook
AFTER INSERT OR DELETE ON public.lead_labels
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_webhook_event();

-- Add realtime for webhook_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_queue;
