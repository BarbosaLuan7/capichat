-- 1. Tornar o bucket message-attachments privado
UPDATE storage.buckets SET public = false WHERE id = 'message-attachments';

-- 2. Remover política pública existente (se existir)
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Attachments are publicly accessible" ON storage.objects;

-- 3. Criar política de SELECT autenticada baseada em acesso à conversa
CREATE POLICY "Authenticated users can view attachments in accessible conversations"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.media_url LIKE '%' || storage.objects.name
      AND c.assigned_to = auth.uid()
    )
  )
);

-- 4. Manter políticas de INSERT e DELETE para usuários autenticados
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

DROP POLICY IF EXISTS "Authenticated users can delete their attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )
);