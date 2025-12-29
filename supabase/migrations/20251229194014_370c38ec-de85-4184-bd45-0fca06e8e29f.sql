-- =====================================================
-- MULTI-TENANT SYSTEM - Database Structure
-- =====================================================

-- 1. Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create user_tenants association table
CREATE TABLE public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role app_role DEFAULT 'agent',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- 3. Add tenant_id to existing tables
ALTER TABLE public.whatsapp_config ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.labels ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.templates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.funnel_stages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.automations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- 4. Create indexes for performance
CREATE INDEX idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON public.user_tenants(tenant_id);
CREATE INDEX idx_whatsapp_config_tenant_id ON public.whatsapp_config(tenant_id);
CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_tasks_tenant_id ON public.tasks(tenant_id);
CREATE INDEX idx_labels_tenant_id ON public.labels(tenant_id);
CREATE INDEX idx_templates_tenant_id ON public.templates(tenant_id);
CREATE INDEX idx_funnel_stages_tenant_id ON public.funnel_stages(tenant_id);
CREATE INDEX idx_automations_tenant_id ON public.automations(tenant_id);
CREATE INDEX idx_teams_tenant_id ON public.teams(tenant_id);

-- 5. Enable RLS on new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- 6. Create helper function to check tenant access
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id
      AND is_active = true
  ) OR has_role(_user_id, 'admin')
$$;

-- 7. Create function to get user's tenants
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_tenants
  WHERE user_id = _user_id AND is_active = true
$$;

-- 8. Create function to get user's role in a tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_role(_user_id uuid, _tenant_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_tenants
  WHERE user_id = _user_id 
    AND tenant_id = _tenant_id 
    AND is_active = true
  LIMIT 1
$$;

-- 9. RLS Policies for tenants table
CREATE POLICY "Admins can manage all tenants"
ON public.tenants FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view tenants they belong to"
ON public.tenants FOR SELECT
USING (
  id IN (SELECT get_user_tenants(auth.uid()))
  OR has_role(auth.uid(), 'admin')
);

-- 10. RLS Policies for user_tenants table
CREATE POLICY "Admins can manage all user_tenants"
ON public.user_tenants FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own tenant associations"
ON public.user_tenants FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Tenant managers can manage their tenant users"
ON public.user_tenants FOR ALL
USING (
  get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
)
WITH CHECK (
  get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
);

-- 11. Update trigger for tenants
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Enable realtime for tenants table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tenants;