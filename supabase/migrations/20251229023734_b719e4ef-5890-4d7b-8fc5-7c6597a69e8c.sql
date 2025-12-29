-- Adicionar campos para Reply/Quote nas mensagens
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_external_id text,
ADD COLUMN IF NOT EXISTS quoted_message jsonb;

-- Criar índice para busca rápida por external_id (usado para encontrar mensagem citada)
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id) WHERE external_id IS NOT NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.messages.reply_to_external_id IS 'ID externo (WAHA) da mensagem sendo respondida';
COMMENT ON COLUMN public.messages.quoted_message IS 'Dados da mensagem citada: {id, body, from, type}';