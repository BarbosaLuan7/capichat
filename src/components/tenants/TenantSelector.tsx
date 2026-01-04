import { memo } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface TenantSelectorProps {
  className?: string;
  variant?: 'header' | 'sidebar';
}

function TenantSelectorComponent({ className, variant = 'header' }: TenantSelectorProps) {
  const { tenants, currentTenant, setCurrentTenant, isLoading, hasMultipleTenants } = useTenant();

  // Don't show selector if user has no tenants or only one
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (tenants.length === 0) {
    return null;
  }

  if (!hasMultipleTenants) {
    // Single tenant - don't show selector since logo already displays brand
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex items-center gap-2 px-2',
            variant === 'header' 
              ? 'text-white/80 hover:text-white hover:bg-white/10' 
              : 'text-foreground hover:bg-muted',
            className
          )}
        >
          {currentTenant?.logo_url ? (
            <Avatar className="h-5 w-5">
              <AvatarImage src={currentTenant.logo_url} alt={currentTenant.name} />
              <AvatarFallback className="bg-white/20 text-white text-xs">
                {currentTenant.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="text-sm font-medium truncate max-w-32">
            {currentTenant?.name || 'Todas as empresas'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Selecionar empresa
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Option to see all */}
        <DropdownMenuItem
          onClick={() => setCurrentTenant(null)}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-1">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>Todas as empresas</span>
          </div>
          {currentTenant === null && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* List of tenants */}
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => setCurrentTenant(tenant)}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1">
              {tenant.logo_url ? (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={tenant.logo_url} alt={tenant.name} />
                  <AvatarFallback className="text-xs">
                    {tenant.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {tenant.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="truncate">{tenant.name}</span>
            </div>
            {currentTenant?.id === tenant.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const TenantSelector = memo(TenantSelectorComponent);
