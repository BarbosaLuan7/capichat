-- 1. Criar índice UNIQUE na coluna phone para evitar leads duplicados
-- Primeiro, removemos duplicatas se existirem (mantendo o mais antigo)
DELETE FROM public.leads a
USING public.leads b
WHERE a.id > b.id
AND a.phone = b.phone;

-- Criar o índice UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique_idx ON public.leads(phone);

-- 2. Criar índice na coluna external_id para idempotência de mensagens
CREATE INDEX IF NOT EXISTS messages_external_id_idx ON public.messages(external_id) WHERE external_id IS NOT NULL;