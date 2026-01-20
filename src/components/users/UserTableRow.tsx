import { memo } from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getRoleLabel } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

interface UserTableRowProps {
  user: Profile;
  role: AppRole;
  teamName: string;
  getRoleBadgeColor: (role: AppRole) => string;
  onEdit: (user: Profile) => void;
  onToggleStatus: (userId: string, isActive: boolean) => void;
  isUpdating: boolean;
}

function UserTableRowComponent({
  user,
  role,
  teamName,
  getRoleBadgeColor,
  onEdit,
  onToggleStatus,
  isUpdating,
}: UserTableRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn('text-xs', getRoleBadgeColor(role))}>{getRoleLabel(role)}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{teamName}</TableCell>
      <TableCell>
        <Switch
          checked={user.is_active}
          onCheckedChange={(checked) => onToggleStatus(user.id, checked)}
          disabled={isUpdating}
          aria-label={user.is_active ? 'Desativar usuário' : 'Ativar usuário'}
        />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Opções">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(user)}>Editar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export const UserTableRow = memo(UserTableRowComponent, (prev, next) => {
  return (
    prev.user.id === next.user.id &&
    prev.user.is_active === next.user.is_active &&
    prev.user.updated_at === next.user.updated_at &&
    prev.role === next.role &&
    prev.teamName === next.teamName &&
    prev.isUpdating === next.isUpdating
  );
});
