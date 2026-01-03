-- Drop existing trigger if exists (to recreate with updated logic)
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON public.messages;
DROP FUNCTION IF EXISTS public.update_conversation_on_new_message();

-- Create improved function that updates last_message_at correctly
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
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
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at <= NEW.created_at);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_new_message();