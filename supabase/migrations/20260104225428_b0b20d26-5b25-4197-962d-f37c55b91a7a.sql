-- Função para obter os WhatsApp configs que o usuário pode acessar baseado nas equipes dele
CREATE OR REPLACE FUNCTION public.get_user_whatsapp_configs(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT twc.whatsapp_config_id
  FROM team_members tm
  JOIN team_whatsapp_configs twc ON tm.team_id = twc.team_id
  WHERE tm.user_id = _user_id
$$;

-- Remover política antiga
DROP POLICY IF EXISTS "Users can view conversations from their tenants" ON conversations;

-- Nova política: usuário vê conversa se:
-- 1. É admin ou manager (vê tudo)
-- 2. A conversa está atribuída a ele
-- 3. O whatsapp_instance_id da conversa está nos configs das equipes dele
CREATE POLICY "Users can view conversations by team access"
ON conversations FOR SELECT
USING (
  -- Admins e managers veem tudo
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  OR
  -- Conversa atribuída ao usuário
  assigned_to = auth.uid()
  OR
  -- WhatsApp config está nas equipes do usuário E lead pertence ao tenant do usuário
  (
    whatsapp_instance_id IN (SELECT get_user_whatsapp_configs(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = conversations.lead_id 
      AND leads.tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
  )
);