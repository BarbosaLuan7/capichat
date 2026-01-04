-- Atribuir conversa à Marina diretamente (bypass do trigger para teste)
-- Primeiro, criar função helper para atribuição administrativa
CREATE OR REPLACE FUNCTION public.admin_assign_conversation(
  _conversation_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations 
  SET assigned_to = _user_id
  WHERE id = _conversation_id;
END;
$$;