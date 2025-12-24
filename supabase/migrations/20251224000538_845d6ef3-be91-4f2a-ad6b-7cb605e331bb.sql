-- Add columns to track Facebook LID leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS is_facebook_lid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_lid TEXT;

-- Index for quick lookups by original_lid
CREATE INDEX IF NOT EXISTS idx_leads_original_lid ON public.leads(original_lid) WHERE original_lid IS NOT NULL;