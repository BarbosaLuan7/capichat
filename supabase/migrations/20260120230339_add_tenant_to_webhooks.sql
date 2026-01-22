-- =============================================
-- ADICIONAR tenant_id NA TABELA webhooks
-- =============================================

-- 1. Adicionar coluna tenant_id
ALTER TABLE public.webhooks
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2. Criar índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON public.webhooks(tenant_id);

-- 3. Atualizar RLS para filtrar por tenant
DROP POLICY IF EXISTS "Admins can manage webhooks" ON public.webhooks;
DROP POLICY IF EXISTS "Managers can view webhooks" ON public.webhooks;

CREATE POLICY "Users can manage own tenant webhooks"
  ON public.webhooks FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. Atualizar função validate_api_key para retornar tenant_id
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key TEXT)
RETURNS TABLE(api_key_id UUID, tenant_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key_id UUID;
  v_tenant_id UUID;
  v_key_hash TEXT;
BEGIN
  -- Gerar hash da key
  v_key_hash := encode(sha256(p_api_key::bytea), 'hex');

  -- Buscar key ativa e tenant associado
  SELECT ak.id, p.tenant_id
  INTO v_api_key_id, v_tenant_id
  FROM public.api_keys ak
  JOIN public.profiles p ON ak.created_by = p.id
  WHERE ak.key_hash = v_key_hash
    AND ak.is_active = true;

  -- Atualizar last_used_at e usage_count
  IF v_api_key_id IS NOT NULL THEN
    UPDATE public.api_keys
    SET last_used_at = now(),
        usage_count = usage_count + 1
    WHERE id = v_api_key_id;
  END IF;

  RETURN QUERY SELECT v_api_key_id, v_tenant_id;
END;
$$;

-- 5. Comentário explicativo
COMMENT ON COLUMN public.webhooks.tenant_id IS 'Tenant ao qual este webhook pertence. Obrigatório para multi-tenancy.';
