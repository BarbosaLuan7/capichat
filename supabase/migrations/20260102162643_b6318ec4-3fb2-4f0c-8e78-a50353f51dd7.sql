-- Add column for local soft delete (hide message only for current user)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted_locally boolean DEFAULT false;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_messages_deleted_locally ON public.messages(conversation_id, is_deleted_locally) WHERE is_deleted_locally = false;