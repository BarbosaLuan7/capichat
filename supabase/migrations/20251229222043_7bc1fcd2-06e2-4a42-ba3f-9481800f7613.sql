
-- =====================================================
-- MULTI-TENANT RLS POLICIES UPDATE
-- =====================================================

-- =====================================================
-- 1. LEADS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and managers can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins and managers can update all leads" ON leads;
DROP POLICY IF EXISTS "Admins and managers can insert leads" ON leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON leads;

-- New tenant-aware policies
CREATE POLICY "Users can view leads from their tenants"
ON leads FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Users can insert leads in their tenants"
ON leads FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'agent'))
  AND (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
);

CREATE POLICY "Users can update leads from their tenants"
ON leads FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR (
    (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
    AND (has_role(auth.uid(), 'manager') OR assigned_to = auth.uid())
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
    AND (has_role(auth.uid(), 'manager') OR assigned_to = auth.uid())
  )
);

CREATE POLICY "Admins can delete leads"
ON leads FOR DELETE USING (
  has_role(auth.uid(), 'admin')
);

-- =====================================================
-- 2. CONVERSATIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view conversations they have access to" ON conversations;
DROP POLICY IF EXISTS "Users can manage conversations they have access to" ON conversations;
DROP POLICY IF EXISTS "Agents can view conversations for their assigned leads" ON conversations;

CREATE POLICY "Users can view conversations from their tenants"
ON conversations FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM leads 
    WHERE leads.id = conversations.lead_id 
    AND (
      leads.tenant_id IS NULL 
      OR leads.tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
    AND leads.assigned_to = auth.uid()
  )
);

CREATE POLICY "Users can manage conversations from their tenants"
ON conversations FOR ALL USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM leads 
    WHERE leads.id = conversations.lead_id 
    AND leads.tenant_id IN (SELECT get_user_tenants(auth.uid()))
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM leads 
    WHERE leads.id = conversations.lead_id 
    AND leads.tenant_id IN (SELECT get_user_tenants(auth.uid()))
  )
);

-- =====================================================
-- 3. TASKS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view tasks assigned to them or all if admin/manager" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks or all if admin/manager" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;

CREATE POLICY "Users can view tasks from their tenants"
ON tasks FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Users can create tasks in their tenants"
ON tasks FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  AND (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
);

CREATE POLICY "Users can update tasks from their tenants"
ON tasks FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR (
    (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
    AND has_role(auth.uid(), 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR (
    (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenants(auth.uid())))
    AND has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Admins can delete tasks"
ON tasks FOR DELETE USING (
  has_role(auth.uid(), 'admin')
);

-- =====================================================
-- 4. LABELS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view labels" ON labels;
DROP POLICY IF EXISTS "Admins can manage labels" ON labels;

CREATE POLICY "Users can view labels from their tenants or global"
ON labels FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Tenant admins can manage labels"
ON labels FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can update labels"
ON labels FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can delete labels"
ON labels FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- =====================================================
-- 5. TEMPLATES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view templates" ON templates;
DROP POLICY IF EXISTS "Admins and managers can manage templates" ON templates;

CREATE POLICY "Users can view templates from their tenants or global"
ON templates FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Tenant admins can manage templates"
ON templates FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can update templates"
ON templates FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can delete templates"
ON templates FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- =====================================================
-- 6. FUNNEL_STAGES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view funnel stages" ON funnel_stages;
DROP POLICY IF EXISTS "Admins can manage funnel stages" ON funnel_stages;

CREATE POLICY "Users can view funnel stages from their tenants or global"
ON funnel_stages FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Tenant admins can manage funnel stages"
ON funnel_stages FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can update funnel stages"
ON funnel_stages FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can delete funnel stages"
ON funnel_stages FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- =====================================================
-- 7. AUTOMATIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view active automations" ON automations;
DROP POLICY IF EXISTS "Admins can manage automations" ON automations;

CREATE POLICY "Users can view automations from their tenants or global"
ON automations FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Tenant admins can manage automations"
ON automations FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can update automations"
ON automations FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can delete automations"
ON automations FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- =====================================================
-- 8. TEAMS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view teams" ON teams;
DROP POLICY IF EXISTS "Admins and managers can manage teams" ON teams;

CREATE POLICY "Users can view teams from their tenants or global"
ON teams FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Tenant admins can manage teams"
ON teams FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can update teams"
ON teams FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can delete teams"
ON teams FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

-- =====================================================
-- 9. WHATSAPP_CONFIG TABLE
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage whatsapp config" ON whatsapp_config;

CREATE POLICY "Users can view whatsapp configs from their tenants"
ON whatsapp_config FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR tenant_id IS NULL
  OR tenant_id IN (SELECT get_user_tenants(auth.uid()))
);

CREATE POLICY "Tenant admins can manage whatsapp config"
ON whatsapp_config FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can update whatsapp config"
ON whatsapp_config FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
) WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);

CREATE POLICY "Tenant admins can delete whatsapp config"
ON whatsapp_config FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('admin', 'manager')
  )
);
