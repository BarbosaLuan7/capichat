-- Usar abordagem mais simples: verificar se auth.uid() é NULL (chamada administrativa)
CREATE OR REPLACE FUNCTION public.check_conversation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se auth.uid() é NULL, é uma chamada administrativa - permitir
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Se não é admin/manager, não pode mudar assigned_to
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) THEN
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      RAISE EXCEPTION 'Agents cannot reassign conversations';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;