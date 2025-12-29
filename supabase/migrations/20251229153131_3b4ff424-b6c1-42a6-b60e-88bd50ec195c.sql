-- Permitir sender_id nulo para mensagens enviadas pelo celular/WhatsApp Web
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;