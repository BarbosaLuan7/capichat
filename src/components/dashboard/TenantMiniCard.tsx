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
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-background group-hover:ring-primary/20 transition-all">
            {tenant.logo_url ? (
              <AvatarImage src={tenant.logo_url} alt={tenant.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {tenant.name}
            </p>
            {stats ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
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
              <div className="h-4 w-20 bg-muted animate-pulse rounded mt-1" />
            )}
          </div>
          
          <div className="text-right">
            {stats ? (
              <>
                <div className="flex items-center gap-1 justify-end">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-lg font-bold text-primary">
                    {stats.resolutionRate}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">resolução</p>
              </>
            ) : (
              <div className="h-8 w-12 bg-muted animate-pulse rounded" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const TenantMiniCard = memo(TenantMiniCardComponent);
