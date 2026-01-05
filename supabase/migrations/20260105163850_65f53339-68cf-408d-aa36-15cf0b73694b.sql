-- Sprint Segurança: Correções Críticas de RLS
-- ============================================

-- 1. CRÍTICO: Restringir WhatsApp Config SELECT para admin/manager
-- Problema: Qualquer usuário do tenant pode ver api_key e webhook_secret
DROP POLICY IF EXISTS "Tenant users can view whatsapp config" ON whatsapp_config;

CREATE POLICY "Tenant admins can view whatsapp config"
ON whatsapp_config FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- 2. IMPORTANTE: Corrigir Leads Policy - remover acesso a leads não atribuídos para agentes
-- Problema: Leads com assigned_to IS NULL são visíveis a TODOS os usuários do tenant
DROP POLICY IF EXISTS "Users can view leads from their tenants" ON leads;

CREATE POLICY "Users can view leads from their tenants"
ON leads FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (assigned_to = auth.uid())
  OR (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- 3. MÉDIO: Corrigir Automation Logs - adicionar filtro por tenant
-- Problema: Managers veem logs de automações de outros tenants
DROP POLICY IF EXISTS "Managers can view automation logs" ON automation_logs;

CREATE POLICY "Managers can view automation logs from their tenants"
ON automation_logs FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_logs.automation_id
      AND (a.tenant_id IS NULL OR a.tenant_id IN (SELECT get_user_tenants(auth.uid())))
    )
  )
);

-- 4. GDPR: Adicionar DELETE Policy para Lead History
-- Problema: Sem policy de DELETE, impossível remover histórico para conformidade GDPR
CREATE POLICY "Admins can delete lead history"
ON lead_history FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Marcar findings corrigidos atualizando comentário para rastreabilidade
COMMENT ON POLICY "Tenant admins can view whatsapp config" ON whatsapp_config IS 'Security fix: Restricted to admin/manager only - agents must use whatsapp_config_safe view';
COMMENT ON POLICY "Users can view leads from their tenants" ON leads IS 'Security fix: Removed access to unassigned leads for agents';
COMMENT ON POLICY "Managers can view automation logs from their tenants" ON automation_logs IS 'Security fix: Added tenant isolation for automation logs';
COMMENT ON POLICY "Admins can delete lead history" ON lead_history IS 'GDPR compliance: Allow admins to delete lead history';