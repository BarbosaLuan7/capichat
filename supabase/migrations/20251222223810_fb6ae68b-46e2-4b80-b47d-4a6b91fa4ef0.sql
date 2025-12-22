-- Adicionar campo para armazenar ID externo da mensagem do WhatsApp
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Criar índice para busca rápida por external_id
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id) WHERE external_id IS NOT NULL;