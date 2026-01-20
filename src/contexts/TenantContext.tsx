import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserTenant {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  is_active: boolean;
  created_at: string;
  tenant?: Tenant;
}

interface TenantContextType {
  tenants: Tenant[];
  userTenants: UserTenant[];
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  hasMultipleTenants: boolean;
  getUserTenantRole: (tenantId: string) => 'admin' | 'manager' | 'agent' | 'viewer' | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = 'gd_current_tenant_id';

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { authUser, isAuthenticated } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [userTenants, setUserTenants] = useState<UserTenant[]>([]);
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserTenants = useCallback(async () => {
    if (!authUser?.id) {
      setTenants([]);
      setUserTenants([]);
      setCurrentTenantState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch user's tenant associations with tenant details
      const { data: userTenantsData, error: utError } = await supabase
        .from('user_tenants')
        .select(
          `
          *,
          tenant:tenants(*)
        `
        )
        .eq('user_id', authUser.id)
        .eq('is_active', true);

      if (utError) throw utError;

      const fetchedUserTenants = (userTenantsData || []).map((ut: any) => ({
        ...ut,
        tenant: ut.tenant as Tenant,
      }));

      setUserTenants(fetchedUserTenants);

      // Extract tenants from user_tenants
      const fetchedTenants = fetchedUserTenants
        .filter((ut: UserTenant) => ut.tenant?.is_active)
        .map((ut: UserTenant) => ut.tenant as Tenant);

      setTenants(fetchedTenants);

      // Restore current tenant from localStorage or default to first
      const savedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
      const savedTenant = fetchedTenants.find((t: Tenant) => t.id === savedTenantId);

      if (savedTenant) {
        setCurrentTenantState(savedTenant);
      } else if (fetchedTenants.length === 1) {
        // Auto-select if user has only one tenant
        setCurrentTenantState(fetchedTenants[0]);
        localStorage.setItem(TENANT_STORAGE_KEY, fetchedTenants[0].id);
      } else if (fetchedTenants.length > 1) {
        // Multiple tenants, set to null (show all)
        setCurrentTenantState(null);
      }
    } catch (err) {
      logger.error('Error fetching tenants:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserTenants();
    } else {
      setTenants([]);
      setUserTenants([]);
      setCurrentTenantState(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchUserTenants]);

  const setCurrentTenant = useCallback((tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    if (tenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY);
    }
  }, []);

  const getUserTenantRole = useCallback(
    (tenantId: string) => {
      const ut = userTenants.find((ut) => ut.tenant_id === tenantId);
      return ut?.role || null;
    },
    [userTenants]
  );

  const value: TenantContextType = {
    tenants,
    userTenants,
    currentTenant,
    setCurrentTenant,
    isLoading,
    error,
    refetch: fetchUserTenants,
    hasMultipleTenants: tenants.length > 1,
    getUserTenantRole,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
