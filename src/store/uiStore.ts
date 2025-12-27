import { create } from 'zustand';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const getInitialSidebarState = (): boolean => {
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
};

interface UIState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: getInitialSidebarState(),
  
  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // Ignore localStorage errors
    }
    set({ sidebarCollapsed: collapsed });
  },
  
  toggleSidebar: () => set((state) => {
    const newValue = !state.sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
    } catch {
      // Ignore localStorage errors
    }
    return { sidebarCollapsed: newValue };
  }),
}));
