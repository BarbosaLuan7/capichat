-- Add avatar_url column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.avatar_url IS 'URL da foto de perfil do WhatsApp do lead';