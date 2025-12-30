-- Fix: Recreate VIEW without SECURITY DEFINER (use SECURITY INVOKER)
DROP VIEW IF EXISTS whatsapp_config_safe;

CREATE VIEW whatsapp_config_safe 
WITH (security_invoker = true)
AS
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