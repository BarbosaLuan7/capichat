-- Função para verificar se usuário pode ver conversa baseado no access_level da equipe
-- access_level 'all': todos da equipe veem todas as conversas
-- access_level 'team': supervisores veem tudo, atendentes só as atribuídas
-- access_level 'attendant': cada um só vê as conversas atribuídas a ele
CREATE OR REPLACE FUNCTION public.can_view_conversation_by_team(
  _user_id uuid, 
  _whatsapp_instance_id uuid, 
  _assigned_to uuid, 
  _lead_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_whatsapp_configs twc
    JOIN teams t ON t.id = twc.team_id
    JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = _user_id
    WHERE twc.whatsapp_config_id = _whatsapp_instance_id
    AND EXISTS (
      SELECT 1 FROM leads l 
      WHERE l.id = _lead_id 
      AND l.tenant_id IN (SELECT get_user_tenants(_user_id))
    )
    AND (
      -- access_level 'all' ou NULL: todos veem todas as conversas
      COALESCE(t.access_level, 'all') = 'all'
      OR
      -- access_level 'team': supervisores veem tudo, demais só se atribuído
      (t.access_level = 'team' AND (tm.is_supervisor = true OR _assigned_to = _user_id))
      OR
      -- access_level 'attendant': só vê se atribuído a ele
      (t.access_level = 'attendant' AND _assigned_to = _user_id)
    )
  )
$$;

-- Remover política anterior
DROP POLICY IF EXISTS "Users can view conversations by team access" ON conversations;

-- Nova política com lógica de access_level
CREATE POLICY "Users can view conversations by team access"
ON conversations FOR SELECT
USING (
  -- Admins e managers veem tudo
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  OR
  -- Conversa atribuída ao usuário (sempre pode ver)
  assigned_to = auth.uid()
  OR
  -- Verificar acesso baseado na equipe e seu access_level
  can_view_conversation_by_team(auth.uid(), whatsapp_instance_id, assigned_to, lead_id)
);