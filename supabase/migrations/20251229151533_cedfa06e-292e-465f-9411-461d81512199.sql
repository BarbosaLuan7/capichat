-- Adicionar coluna source para rastrear origem das mensagens
-- Usando TEXT em vez de ENUM para maior flexibilidade

-- Adicionar coluna source com default 'unknown'
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown';

-- Criar índice para melhor performance na deduplicação
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id) WHERE external_id IS NOT NULL;

-- Atualizar mensagens existentes baseado em sender_type
UPDATE public.messages 
SET source = CASE 
  WHEN sender_type = 'lead' THEN 'lead'
  WHEN sender_type = 'agent' THEN 'crm'
  ELSE 'unknown'
END
WHERE source IS NULL OR source = 'unknown';

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.messages.source IS 'Origem da mensagem: crm, mobile, lead, automation, webhook, unknown';