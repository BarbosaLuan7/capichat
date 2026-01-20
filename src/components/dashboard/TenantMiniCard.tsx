import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, MessageCircle, TrendingUp } from 'lucide-react';
import type { Tenant } from '@/contexts/TenantContext';

interface TenantStats {
  totalLeads: number;
  openConversations: number;
  resolutionRate: number;
}

interface TenantMiniCardProps {
  tenant: Tenant;
  stats?: TenantStats;
  onClick: () => void;
}

function TenantMiniCardComponent({ tenant, stats, onClick }: TenantMiniCardProps) {
  const initials = tenant.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-accent/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-background transition-all group-hover:ring-primary/20">
            {tenant.logo_url ? <AvatarImage src={tenant.logo_url} alt={tenant.name} /> : null}
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
              {tenant.name}
            </p>
            {stats ? (
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {stats.totalLeads}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {stats.openConversations}
                </span>
              </div>
            ) : (
              <div className="mt-1 h-4 w-20 animate-pulse rounded bg-muted" />
            )}
          </div>

          <div className="text-right">
            {stats ? (
              <>
                <div className="flex items-center justify-end gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-lg font-bold text-primary">{stats.resolutionRate}%</span>
                </div>
                <p className="text-xs text-muted-foreground">resolução</p>
              </>
            ) : (
              <div className="h-8 w-12 animate-pulse rounded bg-muted" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const TenantMiniCard = memo(TenantMiniCardComponent);
