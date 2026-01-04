-- Atualizar função check_conversation_update para permitir chamadas de SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_conversation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se session user é diferente de current user, é uma função SECURITY DEFINER - permitir
  IF session_user != current_user THEN
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