-- Adicionar campo last_message_content na tabela conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS last_message_content TEXT;

-- Criar função para atualizar last_message_content quando uma mensagem é criada
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar a conversa com o conteúdo da última mensagem
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_content = CASE 
      WHEN NEW.type = 'text' THEN LEFT(NEW.content, 100)
      WHEN NEW.type = 'image' THEN '📷 Imagem'
      WHEN NEW.type = 'audio' THEN '🎵 Áudio'
      WHEN NEW.type = 'video' THEN '🎬 Vídeo'
      WHEN NEW.type = 'document' THEN '📄 Documento'
      ELSE NEW.content
    END,
    unread_count = CASE 
      WHEN NEW.sender_type = 'lead' THEN unread_count + 1 
      ELSE unread_count 
    END
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para atualizar automaticamente
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON public.messages;
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Atualizar conversas existentes com a última mensagem
UPDATE public.conversations c
SET last_message_content = (
  SELECT CASE 
    WHEN m.type = 'text' THEN LEFT(m.content, 100)
    WHEN m.type = 'image' THEN '📷 Imagem'
    WHEN m.type = 'audio' THEN '🎵 Áudio'
    WHEN m.type = 'video' THEN '🎬 Vídeo'
    WHEN m.type = 'document' THEN '📄 Documento'
    ELSE m.content
  END
  FROM public.messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
);