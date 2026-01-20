import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useConversationFilters } from '@/hooks/useConversationFilters';
import { useLabels } from '@/hooks/useLabels';
import { useProfiles } from '@/hooks/useProfiles';
import { useTenant } from '@/contexts/TenantContext';

interface InboxWithCount {
  id: string;
  name: string;
  phone_number: string | null;
  conversationCount: number;
}

interface ActiveFilterChipsProps {
  availableInboxes: InboxWithCount[];
}

export function ActiveFilterChips({ availableInboxes }: ActiveFilterChipsProps) {
  const { filters, toggleInboxExclusion, toggleLabel, toggleUser, toggleTenant } =
    useConversationFilters();
  const { data: allLabels } = useLabels();
  const { data: profiles } = useProfiles();
  const { userTenants } = useTenant();

  // Format phone for display (abbreviated)
  const formatPhoneShort = (phone: string | null, name: string) => {
    if (phone) {
      if (phone.length >= 4) {
        return `...${phone.slice(-4)}`;
      }
      return phone;
    }
    return name.slice(0, 8);
  };

  // Active filters: excluded inboxes, labels, users, tenants
  const hasActiveFilters =
    filters.excludedInboxIds.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.userIds.length > 0 ||
    filters.tenantIds.length > 0;

  if (!hasActiveFilters) return null;

  // Collect all chips
  const chips: { key: string; label: string; color?: string; onRemove: () => void }[] = [];

  // Excluded inbox chips (show which inboxes are EXCLUDED/hidden)
  filters.excludedInboxIds.forEach((inboxId) => {
    const inbox = availableInboxes.find((i) => i.id === inboxId);
    if (inbox) {
      chips.push({
        key: `inbox-excluded-${inboxId}`,
        label: `✕ ${formatPhoneShort(inbox.phone_number, inbox.name)}`,
        onRemove: () => toggleInboxExclusion(inboxId),
      });
    }
  });

  // Label chips
  filters.labelIds.forEach((labelId) => {
    const label = allLabels?.find((l) => l.id === labelId);
    if (label) {
      chips.push({
        key: `label-${labelId}`,
        label: label.name,
        color: label.color,
        onRemove: () => toggleLabel(labelId),
      });
    }
  });

  // User chips
  filters.userIds.forEach((userId) => {
    if (userId === 'unassigned') {
      chips.push({
        key: 'user-unassigned',
        label: 'Não atribuído',
        onRemove: () => toggleUser('unassigned'),
      });
    } else {
      const profile = profiles?.find((p) => p.id === userId);
      if (profile) {
        chips.push({
          key: `user-${userId}`,
          label: profile.name.split(' ')[0], // First name only
          onRemove: () => toggleUser(userId),
        });
      }
    }
  });

  // Tenant chips
  filters.tenantIds.forEach((tenantId) => {
    const ut = userTenants?.find((t) => t.tenant.id === tenantId);
    if (ut) {
      chips.push({
        key: `tenant-${tenantId}`,
        label: ut.tenant.name,
        onRemove: () => toggleTenant(tenantId),
      });
    }
  });

  const visibleChips = chips.slice(0, 3);
  const hiddenCount = chips.length - 3;

  return (
    <div
      className="flex flex-wrap items-center gap-1 px-2 pb-1"
      role="group"
      aria-label="Filtros ativos"
    >
      {visibleChips.map((chip) => (
        <button
          key={chip.key}
          className="text-2xs inline-flex h-5 cursor-pointer items-center gap-1 rounded-full px-2 py-0 transition-colors hover:opacity-80"
          style={{
            backgroundColor: chip.color || 'hsl(var(--muted))',
            color: chip.color ? 'white' : 'hsl(var(--muted-foreground))',
          }}
          onClick={chip.onRemove}
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="text-2xs h-5 px-2 py-0">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
