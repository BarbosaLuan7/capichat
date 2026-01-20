import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Users, MessageCircle, ArrowRight } from 'lucide-react';
import { TenantMiniCard } from './TenantMiniCard';
import type { Tenant } from '@/contexts/TenantContext';

interface TenantStats {
  totalLeads: number;
  openConversations: number;
  resolutionRate: number;
}

interface TenantIndicatorCardProps {
  tenant: Tenant | null;
  tenants: Tenant[];
  stats: Record<string, TenantStats>;
  isLoading: boolean;
  onSelectTenant: (tenant: Tenant | null) => void;
}

function TenantIndicatorCardComponent({
  tenant,
  tenants,
  stats,
  isLoading,
  onSelectTenant,
}: TenantIndicatorCardProps) {
  // Don't render if user has only one tenant
  if (tenants.length <= 1) {
    return null;
  }

  // Specific tenant selected
  if (tenant) {
    const tenantStats = stats[tenant.id];
    const initials = tenant.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    return (
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            {tenant.logo_url ? <AvatarImage src={tenant.logo_url} alt={tenant.name} /> : null}
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{tenant.name}</h3>
              <Badge variant="default" className="text-xs">
                Ativo
              </Badge>
            </div>
            {isLoading ? (
              <div className="mt-1 h-4 w-48 animate-pulse rounded bg-muted" />
            ) : tenantStats ? (
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {tenantStats.totalLeads} leads
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {tenantStats.openConversations} conversas abertas
                </span>
                <span className="font-medium text-primary">
                  {tenantStats.resolutionRate}% resolução
                </span>
              </div>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectTenant(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            Ver todas empresas
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // All tenants view (consolidated)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium text-foreground">Visão consolidada</span>
        <Badge variant="outline" className="text-xs">
          {tenants.length} empresas
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tenants.map((t) => (
          <TenantMiniCard
            key={t.id}
            tenant={t}
            stats={stats[t.id]}
            onClick={() => onSelectTenant(t)}
          />
        ))}
      </div>
    </div>
  );
}

export const TenantIndicatorCard = memo(TenantIndicatorCardComponent);
