-- Adiciona campo para cachear o chatId do WhatsApp (evita chamadas repetidas à API check-exists)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_chat_id text;

-- Comentário explicativo
COMMENT ON COLUMN public.leads.whatsapp_chat_id IS 'ChatId do WhatsApp cacheado (formato: 5511999999999@c.us ou @lid). Evita chamadas repetidas à API check-exists do WAHA.';