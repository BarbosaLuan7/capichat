-- 1. Remover política problemática que permite acesso amplo
DROP POLICY IF EXISTS "Users can manage conversations from their tenants" ON conversations;

-- 2. Garantir que a política de SELECT está correta (recriar)
DROP POLICY IF EXISTS "Users can view conversations by team access" ON conversations;

CREATE POLICY "Users can view conversations by team access"
ON conversations FOR SELECT
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR can_view_conversation_by_team(auth.uid(), whatsapp_instance_id, assigned_to, lead_id)
);

-- 3. Política para INSERT - criar conversas se lead pertence ao tenant
CREATE POLICY "Users can create conversations in their tenant"
ON conversations FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR EXISTS (
    SELECT 1 FROM leads 
    WHERE leads.id = lead_id 
    AND leads.tenant_id IN (SELECT get_user_tenants(auth.uid()))
  )
);

-- 4. Política para UPDATE - atualizar se pode ver
CREATE POLICY "Users can update accessible conversations"
ON conversations FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR can_view_conversation_by_team(auth.uid(), whatsapp_instance_id, assigned_to, lead_id)
);

-- 5. Política para DELETE - somente admins
CREATE POLICY "Admins can delete conversations"
ON conversations FOR DELETE
USING (has_role(auth.uid(), 'admin'));