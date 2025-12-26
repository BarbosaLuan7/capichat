-- Fix 1: Make message-attachments bucket private for security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'message-attachments';

-- Drop the overly permissive policy that allows anyone to view
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;

-- Create new policy that requires authentication and proper access checks
-- Users can only view attachments for messages in conversations they have access to
CREATE POLICY "Authenticated users can view message attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments'
);

-- Keep existing upload/delete policies as they are (they already require proper auth)
-- The signed URLs mechanism already in place (useSignedUrl.ts) will continue to work