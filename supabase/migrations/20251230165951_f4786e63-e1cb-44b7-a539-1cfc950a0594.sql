-- =============================================
-- FASE 1: CORREÇÕES CRÍTICAS
-- =============================================

-- 1.1 Restringir acesso a profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view profiles from same tenant or team" 
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  id = auth.uid() OR
  team_id IS NOT NULL AND team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.user_tenants ut1
    JOIN public.user_tenants ut2 ON ut1.tenant_id = ut2.tenant_id
    WHERE ut1.user_id = auth.uid() AND ut2.user_id = profiles.id AND ut1.is_active = true AND ut2.is_active = true
  )
);

-- 1.2 Restringir acesso a leads para agentes
DROP POLICY IF EXISTS "Users can view leads from their tenants" ON public.leads;

CREATE POLICY "Users can view leads from their tenants" 
ON public.leads FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  assigned_to = auth.uid() OR
  (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin'::app_role, 'manager'::app_role)
  )
);

-- 1.3 Restringir acesso a whatsapp_config
CREATE POLICY "Admins and managers can view whatsapp config" 
ON public.whatsapp_config FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin'::app_role, 'manager'::app_role)
  )
);

-- 1.4 Restringir webhooks a admins (remover acesso de managers)
DROP POLICY IF EXISTS "Managers can view webhooks" ON public.webhooks;

-- =============================================
-- FASE 2: CORREÇÕES DE PRIORIDADE ALTA
-- =============================================

-- 2.1 Criar função para validar update de conversations
CREATE OR REPLACE FUNCTION public.check_conversation_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não é admin/manager, não pode mudar assigned_to
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) THEN
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      RAISE EXCEPTION 'Agents cannot reassign conversations';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.2 Criar trigger para prevenir reatribuição por agentes
DROP TRIGGER IF EXISTS prevent_agent_reassign ON public.conversations;
CREATE TRIGGER prevent_agent_reassign
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.check_conversation_update();

-- 2.3 Restringir inserção de notificações
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Service role or self can create notifications" 
ON public.notifications FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- 2.4 Validar inserção no lead_history
DROP POLICY IF EXISTS "System can insert lead history" ON public.lead_history;

CREATE POLICY "Validated insert lead history" 
ON public.lead_history FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- =============================================
-- FASE 3: MELHORIAS DE SEGURANÇA
-- =============================================

-- 3.1 Prevenir UPDATE em messages (logs imutáveis)
CREATE POLICY "No updates to messages" ON public.messages
FOR UPDATE USING (false);

-- 3.2 Restringir DELETE em messages apenas para admins
CREATE POLICY "Only admins can delete messages" ON public.messages
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 3.3 Prevenir UPDATE em lead_activities
CREATE POLICY "No updates to lead_activities" ON public.lead_activities
FOR UPDATE USING (false);

-- 3.4 Prevenir DELETE em lead_activities
CREATE POLICY "No deletes to lead_activities" ON public.lead_activities
FOR DELETE USING (false);

-- 3.5 Validar tasks para leads acessíveis
DROP POLICY IF EXISTS "Users can create tasks in their tenants" ON public.tasks;

CREATE POLICY "Users can create tasks for accessible leads" 
ON public.tasks FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  (
    assigned_to = auth.uid() AND
    (lead_id IS NULL OR EXISTS (
      SELECT 1 FROM public.leads 
      WHERE id = tasks.lead_id 
      AND (
        assigned_to = auth.uid() OR 
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'manager'::app_role) OR
        tenant_id IN (SELECT get_user_tenants(auth.uid()))
      )
    ))
  )
);