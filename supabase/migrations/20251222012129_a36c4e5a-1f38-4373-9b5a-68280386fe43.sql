-- Adicionar novas categorias ao enum label_category
ALTER TYPE label_category ADD VALUE IF NOT EXISTS 'beneficio';
ALTER TYPE label_category ADD VALUE IF NOT EXISTS 'condicao_saude';
ALTER TYPE label_category ADD VALUE IF NOT EXISTS 'desqualificacao';

-- Adicionar campo grupo às etapas do funil para melhor organização
ALTER TABLE public.funnel_stages ADD COLUMN IF NOT EXISTS grupo text;