-- 1. Add waha_message_id column to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS waha_message_id text;

-- 2. Backfill waha_message_id from external_id (extract shortId - last segment after underscore)
UPDATE public.messages
SET waha_message_id = 
  CASE 
    WHEN external_id LIKE '%_%' THEN split_part(external_id, '_', -1)
    ELSE external_id
  END
WHERE waha_message_id IS NULL AND external_id IS NOT NULL;

-- 3. Remove duplicate messages (keep the oldest one by created_at)
DELETE FROM public.messages m1
USING public.messages m2
WHERE m1.waha_message_id IS NOT NULL 
  AND m1.waha_message_id = m2.waha_message_id
  AND m1.created_at > m2.created_at;

-- 4. Create unique index on waha_message_id (partial - only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_waha_message_id_unique 
ON public.messages (waha_message_id) 
WHERE waha_message_id IS NOT NULL;

-- 5. Handle duplicate conversations - merge messages to oldest conversation
-- First, move messages from duplicate conversations to the oldest one
WITH duplicate_convos AS (
  SELECT 
    lead_id,
    whatsapp_instance_id,
    MIN(created_at) as oldest_created,
    array_agg(id ORDER BY created_at) as all_ids
  FROM public.conversations
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id, whatsapp_instance_id
  HAVING COUNT(*) > 1
),
oldest_convos AS (
  SELECT 
    c.id as oldest_id,
    dc.all_ids
  FROM duplicate_convos dc
  JOIN public.conversations c ON c.lead_id = dc.lead_id 
    AND COALESCE(c.whatsapp_instance_id::text, '') = COALESCE(dc.whatsapp_instance_id::text, '')
    AND c.created_at = dc.oldest_created
)
UPDATE public.messages m
SET conversation_id = oc.oldest_id
FROM oldest_convos oc
WHERE m.conversation_id = ANY(oc.all_ids) 
  AND m.conversation_id != oc.oldest_id;

-- 6. Move internal notes from duplicate conversations
WITH duplicate_convos AS (
  SELECT 
    lead_id,
    whatsapp_instance_id,
    MIN(created_at) as oldest_created,
    array_agg(id ORDER BY created_at) as all_ids
  FROM public.conversations
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id, whatsapp_instance_id
  HAVING COUNT(*) > 1
),
oldest_convos AS (
  SELECT 
    c.id as oldest_id,
    dc.all_ids
  FROM duplicate_convos dc
  JOIN public.conversations c ON c.lead_id = dc.lead_id 
    AND COALESCE(c.whatsapp_instance_id::text, '') = COALESCE(dc.whatsapp_instance_id::text, '')
    AND c.created_at = dc.oldest_created
)
UPDATE public.internal_notes n
SET conversation_id = oc.oldest_id
FROM oldest_convos oc
WHERE n.conversation_id = ANY(oc.all_ids) 
  AND n.conversation_id != oc.oldest_id;

-- 7. Delete duplicate conversations (keep oldest)
WITH duplicate_convos AS (
  SELECT 
    lead_id,
    whatsapp_instance_id,
    MIN(created_at) as oldest_created
  FROM public.conversations
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id, whatsapp_instance_id
  HAVING COUNT(*) > 1
)
DELETE FROM public.conversations c
USING duplicate_convos dc
WHERE c.lead_id = dc.lead_id 
  AND COALESCE(c.whatsapp_instance_id::text, '') = COALESCE(dc.whatsapp_instance_id::text, '')
  AND c.created_at > dc.oldest_created;

-- 8. Create unique index on conversations (lead_id + whatsapp_instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_lead_instance_unique 
ON public.conversations (lead_id, COALESCE(whatsapp_instance_id, '00000000-0000-0000-0000-000000000000'::uuid));