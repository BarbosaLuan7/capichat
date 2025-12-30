-- Remover policy duplicada em whatsapp_config
DROP POLICY IF EXISTS "Users can view whatsapp configs from their tenants" ON public.whatsapp_config;