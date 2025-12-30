import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConversationFilters {
  inboxIds: string[];
  labelIds: string[];
  userIds: string[];
  tenantIds: string[];
}

interface ConversationFiltersStore {
  filters: ConversationFilters;
  
  // Ações para Caixas de Entrada
  toggleInbox: (inboxId: string) => void;
  setAllInboxes: (ids: string[]) => void;
  clearInboxes: () => void;
  
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
        inboxIds: [],
        labelIds: [],
        userIds: [],
        tenantIds: [],
      },
      
      // Inbox actions
      toggleInbox: (inboxId) => set((state) => ({
        filters: {
          ...state.filters,
          inboxIds: state.filters.inboxIds.includes(inboxId)
            ? state.filters.inboxIds.filter(id => id !== inboxId)
            : [...state.filters.inboxIds, inboxId]
        }
      })),
      
      setAllInboxes: (ids) => set((state) => ({
        filters: { ...state.filters, inboxIds: ids }
      })),
      
      clearInboxes: () => set((state) => ({
        filters: { ...state.filters, inboxIds: [] }
      })),
      
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
          inboxIds: [],
          labelIds: [],
          userIds: [],
          tenantIds: [],
        }
      }),
      
      // Count active filters
      getActiveFiltersCount: () => {
        const { filters } = get();
        return (
          filters.inboxIds.length +
          filters.labelIds.length +
          filters.userIds.length +
          filters.tenantIds.length
        );
      }
    }),
    {
      name: 'conversation-filters',
    }
  )
);
