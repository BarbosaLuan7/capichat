-- ============================================
-- SECURITY FIX: Production RLS Hardening
-- ============================================

-- 1. Fix profiles SELECT policy - isolate by tenant
DROP POLICY IF EXISTS "Users can view profiles from same tenant or team" ON profiles;

CREATE POLICY "Users can view profiles from same tenant"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM user_tenants ut1
    JOIN user_tenants ut2 ON ut1.tenant_id = ut2.tenant_id
    WHERE ut1.user_id = auth.uid() 
    AND ut2.user_id = profiles.id
    AND ut1.is_active = true 
    AND ut2.is_active = true
  )
);

-- 2. Fix leads SELECT policy - remove global manager bypass
DROP POLICY IF EXISTS "Users can view leads from their tenants" ON leads;

CREATE POLICY "Users can view leads from their tenants"
ON leads FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
  OR (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND assigned_to IS NULL
  )
);

-- 3. Fix leads UPDATE policy - restrict to tenant scope
DROP POLICY IF EXISTS "Users can update leads from their tenants" ON leads;

CREATE POLICY "Users can update leads from their tenants"
ON leads FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND (
      get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
      OR assigned_to = auth.uid()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND (
      get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
      OR assigned_to = auth.uid()
    )
  )
);

-- 4. Create secure VIEW that masks WhatsApp API keys
CREATE OR REPLACE VIEW whatsapp_config_safe AS
SELECT 
  id,
  name,
  provider,
  base_url,
  CASE 
    WHEN api_key IS NOT NULL THEN '****' || RIGHT(api_key, 4)
    ELSE NULL 
  END as api_key_masked,
  instance_name,
  phone_number,
  is_active,
  CASE WHEN webhook_secret IS NOT NULL THEN true ELSE false END as has_webhook_secret,
  created_by,
  created_at,
  updated_at,
  tenant_id
FROM whatsapp_config;

-- 5. Create secure function for edge functions to get full config
CREATE OR REPLACE FUNCTION get_whatsapp_config_full(config_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  provider text,
  base_url text,
  api_key text,
  instance_name text,
  webhook_secret text,
  tenant_id uuid,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wc.id, wc.name, wc.provider, wc.base_url, 
    wc.api_key, wc.instance_name, wc.webhook_secret, wc.tenant_id, wc.is_active
  FROM whatsapp_config wc
  WHERE wc.id = config_id AND wc.is_active = true
$$;