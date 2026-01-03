-- =============================================================
-- TEAMS ADVANCED FEATURES MIGRATION
-- Adicionar funcionalidades avançadas ao sistema de equipes
-- =============================================================

-- 1. Adicionar novos campos à tabela teams
-- =========================================
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'team',
ADD COLUMN IF NOT EXISTS auto_distribution BOOLEAN DEFAULT false;

-- Adicionar constraint para access_level (usando trigger ao invés de CHECK para evitar problemas)
CREATE OR REPLACE FUNCTION public.validate_team_access_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.access_level NOT IN ('all', 'team', 'attendant') THEN
    RAISE EXCEPTION 'access_level deve ser all, team ou attendant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_team_access_level_trigger ON public.teams;
CREATE TRIGGER validate_team_access_level_trigger
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_team_access_level();

-- Criar índice único para garantir apenas uma equipe padrão por tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_default_per_tenant 
ON public.teams (tenant_id) 
WHERE is_default = true;

-- Comentários para documentação
COMMENT ON COLUMN public.teams.is_default IS 'Se true, novos atendimentos sem equipe definida vão para esta equipe';
COMMENT ON COLUMN public.teams.access_level IS 'Nível de acesso: all=todos veem, team=só equipe vê, attendant=só atendente e supervisores veem';
COMMENT ON COLUMN public.teams.auto_distribution IS 'Se true, distribui atendimentos automaticamente entre membros';

-- 2. Criar tabela team_whatsapp_configs (relação N:N entre teams e whatsapp_config)
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.team_whatsapp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  whatsapp_config_id UUID NOT NULL REFERENCES public.whatsapp_config(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(team_id, whatsapp_config_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_team_whatsapp_configs_team ON public.team_whatsapp_configs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_whatsapp_configs_config ON public.team_whatsapp_configs(whatsapp_config_id);

-- RLS
ALTER TABLE public.team_whatsapp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver canais da própria equipe" ON public.team_whatsapp_configs
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_whatsapp_configs.team_id
      AND (
        t.tenant_id IS NULL OR
        t.tenant_id IN (SELECT get_user_tenants(auth.uid()))
      )
    )
  );

CREATE POLICY "Admins e managers podem gerenciar canais de equipes" ON public.team_whatsapp_configs
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.user_tenants ut ON ut.tenant_id = t.tenant_id
      WHERE t.id = team_whatsapp_configs.team_id
      AND ut.user_id = auth.uid()
      AND ut.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.user_tenants ut ON ut.tenant_id = t.tenant_id
      WHERE t.id = team_whatsapp_configs.team_id
      AND ut.user_id = auth.uid()
      AND ut.role IN ('admin', 'manager')
    )
  );

-- 3. Criar tabela team_members (substitui profiles.team_id para permitir roles por equipe)
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_supervisor BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(team_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_supervisor ON public.team_members(team_id) WHERE is_supervisor = true;

-- RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver membros de equipes do mesmo tenant" ON public.team_members
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
      AND (
        t.tenant_id IS NULL OR
        t.tenant_id IN (SELECT get_user_tenants(auth.uid()))
      )
    )
  );

CREATE POLICY "Admins e managers podem gerenciar membros" ON public.team_members
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.user_tenants ut ON ut.tenant_id = t.tenant_id
      WHERE t.id = team_members.team_id
      AND ut.user_id = auth.uid()
      AND ut.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.user_tenants ut ON ut.tenant_id = t.tenant_id
      WHERE t.id = team_members.team_id
      AND ut.user_id = auth.uid()
      AND ut.role IN ('admin', 'manager')
    )
  );

-- 4. Migrar dados existentes de profiles.team_id para team_members
-- =================================================================
INSERT INTO public.team_members (team_id, user_id, is_supervisor)
SELECT p.team_id, p.id, (p.id = t.supervisor_id)
FROM public.profiles p
JOIN public.teams t ON t.id = p.team_id
WHERE p.team_id IS NOT NULL
ON CONFLICT (team_id, user_id) DO NOTHING;