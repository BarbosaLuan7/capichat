-- Criar tabela de definições de campos personalizados
CREATE TABLE public.custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'boolean')),
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de carteiras de contatos
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de relação carteira <-> contato
CREATE TABLE public.wallet_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wallet_id, lead_id)
);

-- Habilitar RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_contacts ENABLE ROW LEVEL SECURITY;

-- RLS para custom_field_definitions
CREATE POLICY "Admins can manage custom fields"
ON public.custom_field_definitions
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view active custom fields"
ON public.custom_field_definitions
FOR SELECT
USING (
  is_active = true AND
  (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
);

-- RLS para wallets
CREATE POLICY "Admins managers can manage wallets"
ON public.wallets
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view wallets"
ON public.wallets
FOR SELECT
USING (
  is_active = true AND
  (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
);

-- RLS para wallet_contacts
CREATE POLICY "Admins managers can manage wallet contacts"
ON public.wallet_contacts
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view wallet contacts"
ON public.wallet_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM wallets w 
    WHERE w.id = wallet_id 
    AND w.is_active = true
    AND (w.tenant_id IS NULL OR w.tenant_id IN (SELECT get_user_tenants(auth.uid())))
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_custom_field_definitions_updated_at
BEFORE UPDATE ON public.custom_field_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_custom_field_definitions_tenant ON public.custom_field_definitions(tenant_id);
CREATE INDEX idx_wallets_tenant ON public.wallets(tenant_id);
CREATE INDEX idx_wallet_contacts_wallet ON public.wallet_contacts(wallet_id);
CREATE INDEX idx_wallet_contacts_lead ON public.wallet_contacts(lead_id);