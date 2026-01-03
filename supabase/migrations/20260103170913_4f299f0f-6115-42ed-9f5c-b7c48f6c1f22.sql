-- Add transcription column to messages table for persistent cache
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS transcription text;

-- Index for searching transcriptions (optional, for future search feature)
CREATE INDEX IF NOT EXISTS idx_messages_transcription 
ON public.messages USING gin(to_tsvector('portuguese', transcription))
WHERE transcription IS NOT NULL;