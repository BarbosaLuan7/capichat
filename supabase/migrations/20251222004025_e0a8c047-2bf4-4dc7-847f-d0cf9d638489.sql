-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for message attachments bucket
CREATE POLICY "Authenticated users can upload attachments" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add is_starred column to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- Add is_favorite column to conversations for favorite contacts
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- Create internal_notes hook for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notes;