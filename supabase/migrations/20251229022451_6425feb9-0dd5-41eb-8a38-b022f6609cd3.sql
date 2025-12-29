-- Adicionar campo country_code na tabela leads para suporte internacional
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS country_code text DEFAULT '55';

-- Atualizar leads existentes que não têm country_code
UPDATE public.leads SET country_code = '55' WHERE country_code IS NULL;

-- Criar índice para buscas por país
CREATE INDEX IF NOT EXISTS idx_leads_country_code ON public.leads(country_code);

-- Comentário explicativo
COMMENT ON COLUMN public.leads.country_code IS 'Código do país do telefone (ex: 55 para Brasil, 1 para EUA, 595 para Paraguai)';