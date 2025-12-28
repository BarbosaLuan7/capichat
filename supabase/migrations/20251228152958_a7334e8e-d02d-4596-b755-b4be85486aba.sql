-- Remove policy que permite managers ver config do WhatsApp (API keys expostas)
DROP POLICY IF EXISTS "Managers can view whatsapp config" ON public.whatsapp_config;