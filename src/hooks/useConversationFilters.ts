import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConversationFilters {
  // excludedInboxIds: inboxes the user explicitly EXCLUDED (deselected)
  // Empty means "all inboxes" (no filter)
  excludedInboxIds: string[];
  labelIds: string[];
  userIds: string[];
  tenantIds: string[];
}

interface ConversationFiltersStore {
  filters: ConversationFilters;
  
  // Ações para Caixas de Entrada
  toggleInboxExclusion: (inboxId: string) => void;
  excludeAllInboxes: (ids: string[]) => void;
  includeAllInboxes: () => void;
  isInboxIncluded: (inboxId: string) => boolean;
  
  // Ações para Etiquetas
  toggleLabel: (labelId: string) => void;
  clearLabels: () => void;
  
  // Ações para Usuários
  toggleUser: (userId: string) => void;
  clearUsers: () => void;
  
  // Ações para Tenants
  toggleTenant: (tenantId: string) => void;
  clearTenants: () => void;
  
  // Limpar tudo
  clearAllFilters: () => void;
  
  // Computed
  getActiveFiltersCount: () => number;
}

export const useConversationFilters = create<ConversationFiltersStore>()(
  persist(
    (set, get) => ({
      filters: {
        excludedInboxIds: [],
        labelIds: [],
        userIds: [],
        tenantIds: [],
      },
      
      // Inbox actions - now works with EXCLUSION logic
      toggleInboxExclusion: (inboxId) => set((state) => ({
        filters: {
          ...state.filters,
          excludedInboxIds: state.filters.excludedInboxIds.includes(inboxId)
            ? state.filters.excludedInboxIds.filter(id => id !== inboxId)
            : [...state.filters.excludedInboxIds, inboxId]
        }
      })),
      
      excludeAllInboxes: (ids) => set((state) => ({
        filters: { ...state.filters, excludedInboxIds: ids }
      })),
      
      includeAllInboxes: () => set((state) => ({
        filters: { ...state.filters, excludedInboxIds: [] }
      })),
      
      isInboxIncluded: (inboxId) => {
        const { filters } = get();
        return !filters.excludedInboxIds.includes(inboxId);
      },
      
      // Label actions
      toggleLabel: (labelId) => set((state) => ({
        filters: {
          ...state.filters,
          labelIds: state.filters.labelIds.includes(labelId)
            ? state.filters.labelIds.filter(id => id !== labelId)
            : [...state.filters.labelIds, labelId]
        }
      })),
      
      clearLabels: () => set((state) => ({
        filters: { ...state.filters, labelIds: [] }
      })),
      
      // User actions
      toggleUser: (userId) => set((state) => ({
        filters: {
          ...state.filters,
          userIds: state.filters.userIds.includes(userId)
            ? state.filters.userIds.filter(id => id !== userId)
            : [...state.filters.userIds, userId]
        }
      })),
      
      clearUsers: () => set((state) => ({
        filters: { ...state.filters, userIds: [] }
      })),
      
      // Tenant actions
      toggleTenant: (tenantId) => set((state) => ({
        filters: {
          ...state.filters,
          tenantIds: state.filters.tenantIds.includes(tenantId)
            ? state.filters.tenantIds.filter(id => id !== tenantId)
            : [...state.filters.tenantIds, tenantId]
        }
      })),
      
      clearTenants: () => set((state) => ({
        filters: { ...state.filters, tenantIds: [] }
      })),
      
      // Clear all
      clearAllFilters: () => set({
        filters: {
          excludedInboxIds: [],
          labelIds: [],
          userIds: [],
          tenantIds: [],
        }
      }),
      
      // Count active filters - only count excluded inboxes, not included ones
      getActiveFiltersCount: () => {
        const { filters } = get();
        return (
          filters.excludedInboxIds.length +
          filters.labelIds.length +
          filters.userIds.length +
          filters.tenantIds.length
        );
      }
    }),
    {
      name: 'conversation-filters',
      // Migrate old format to new format
      migrate: (persistedState: any, version: number) => {
        if (persistedState?.filters?.inboxIds) {
          // Old format had inboxIds (included), new format has excludedInboxIds
          // If migrating, clear the old data (default to all included)
          return {
            ...persistedState,
            filters: {
              excludedInboxIds: [],
              labelIds: persistedState.filters?.labelIds || [],
              userIds: persistedState.filters?.userIds || [],
              tenantIds: persistedState.filters?.tenantIds || [],
            }
          };
        }
        return persistedState;
      },
      version: 1,
    }
  )
);
