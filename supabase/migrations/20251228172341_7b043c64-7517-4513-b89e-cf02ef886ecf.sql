-- Índice composto para mensagens (otimiza queries de chat)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages(conversation_id, created_at DESC);

-- Adicionar coluna whatsapp_instance_id em conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS whatsapp_instance_id uuid REFERENCES public.whatsapp_config(id);

-- Índice para filtrar conversas por instância
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_instance 
ON public.conversations(whatsapp_instance_id);

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.conversations.whatsapp_instance_id IS 'ID da instância WhatsApp que recebeu/enviou mensagens desta conversa';