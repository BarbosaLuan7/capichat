-- Remover índice parcial existente
DROP INDEX IF EXISTS idx_messages_waha_message_id_unique;

-- Criar constraint UNIQUE real na coluna waha_message_id
-- PostgreSQL permite múltiplos NULLs em UNIQUE constraints
ALTER TABLE public.messages 
ADD CONSTRAINT messages_waha_message_id_unique 
UNIQUE (waha_message_id);