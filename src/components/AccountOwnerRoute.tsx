import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageSkeleton } from '@/components/layout/PageSkeleton';

interface AccountOwnerRouteProps {
  children: ReactNode;
}

/**
 * Protege rotas que só devem ser acessíveis por account owners (Thaw + Luan)
 * Redireciona para /inbox se o usuário não for account owner
 */
export function AccountOwnerRoute({ children }: AccountOwnerRouteProps) {
  const { loading, isAccountOwner, profile } = useAuth();

  // Wait until profile is loaded before deciding
  if (loading || profile === null) {
    return <PageSkeleton />;
  }

  if (!isAccountOwner) {
    return <Navigate to="/inbox" replace />;
  }

  return <>{children}</>;
}
