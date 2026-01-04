-- Corrigir RLS policy de whatsapp_config para permitir que agentes vejam as configurações do seu tenant
-- Isso resolve o problema da Marina não ver conversas atribuídas a ela

DROP POLICY IF EXISTS "Admins and managers can view whatsapp config" ON whatsapp_config;

CREATE POLICY "Tenant users can view whatsapp config" ON whatsapp_config
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR (
      tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
  );