-- BUG-04 FIX: Storage policy to validate file types server-side
-- This prevents bypassing client-side validation

-- First, drop any existing policy with this name to avoid conflicts
DROP POLICY IF EXISTS "Only allowed file types for message attachments" ON storage.objects;

-- Create policy to only allow safe file types in message-attachments bucket
CREATE POLICY "Only allowed file types for message attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (
    -- Allow common safe file extensions only
    name ~* '\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|avi|webm|mp3|wav|ogg|m4a|opus|mpeg|pdf|doc|docx|xls|xlsx|txt|csv)$'
  )
);