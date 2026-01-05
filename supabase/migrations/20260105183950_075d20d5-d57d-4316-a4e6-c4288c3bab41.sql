-- Remover política antiga que bloqueia todos os updates
DROP POLICY IF EXISTS "No updates to messages" ON messages;

-- Criar nova política que permite update de transcription
-- por usuários autenticados com acesso à conversa
CREATE POLICY "Users can update transcription on accessible messages"
ON messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      conversations.assigned_to = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      conversations.assigned_to = auth.uid()
    )
  )
);