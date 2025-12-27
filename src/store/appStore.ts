import { create } from 'zustand';
import { Lead, Conversation, Message, Task, Label, FunnelStage, User, Team, Automation } from '@/types';
import { 
  mockLeads, 
  mockConversations, 
  mockMessages, 
  mockTasks, 
  mockLabels, 
  mockFunnelStages,
  mockUsers,
  mockTeams,
  mockAutomations,
} from '@/data/mockData';

interface AppState {
  // Data
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  tasks: Task[];
  labels: Label[];
  funnelStages: FunnelStage[];
  users: User[];
  teams: Team[];
  automations: Automation[];
  
  // Selected items
  selectedConversationId: string | null;
  selectedLeadId: string | null;
  
  // UI State
  sidebarCollapsed: boolean;
  
  // Actions
  setSelectedConversation: (id: string | null) => void;
  setSelectedLead: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  
  // Lead actions
  updateLeadStage: (leadId: string, stageId: string) => void;
  updateLeadTemperature: (leadId: string, temperature: Lead['temperature']) => void;
  
  // Task actions
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  
  // User actions
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'avatar'>) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  toggleUserStatus: (userId: string) => void;
  
  // Team actions
  addTeam: (team: Omit<Team, 'id' | 'createdAt'>) => void;
  updateTeam: (teamId: string, updates: Partial<Team>) => void;
  deleteTeam: (teamId: string) => void;
  
  // Automation actions
  addAutomation: (automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAutomation: (automationId: string, updates: Partial<Automation>) => void;
  deleteAutomation: (automationId: string) => void;
  toggleAutomationStatus: (automationId: string) => void;
  
  // Message actions
  addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => void;
  markConversationAsRead: (conversationId: string) => void;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const getInitialSidebarState = (): boolean => {
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial data
  leads: mockLeads,
  conversations: mockConversations,
  messages: mockMessages,
  tasks: mockTasks,
  labels: mockLabels,
  funnelStages: mockFunnelStages,
  users: mockUsers,
  teams: mockTeams,
  automations: mockAutomations,
  
  // Selected items
  selectedConversationId: null,
  selectedLeadId: null,
  
  // UI State
  sidebarCollapsed: getInitialSidebarState(),
  
  // Actions
  setSelectedConversation: (id) => set({ selectedConversationId: id }),
  setSelectedLead: (id) => set({ selectedLeadId: id }),
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
  
  // Lead actions
  updateLeadStage: (leadId, stageId) => set((state) => ({
    leads: state.leads.map((lead) =>
      lead.id === leadId ? { ...lead, stageId, updatedAt: new Date() } : lead
    ),
  })),
  
  updateLeadTemperature: (leadId, temperature) => set((state) => ({
    leads: state.leads.map((lead) =>
      lead.id === leadId ? { ...lead, temperature, updatedAt: new Date() } : lead
    ),
  })),
  
  // Task actions
  updateTaskStatus: (taskId, status) => set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === taskId ? { ...task, status } : task
    ),
  })),
  
  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, { ...task, id: `task-${Date.now()}`, createdAt: new Date() }],
  })),
  
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === taskId ? { ...task, ...updates } : task
    ),
  })),
  
  deleteTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((task) => task.id !== taskId),
  })),
  
  // User actions
  addUser: (user) => set((state) => ({
    users: [...state.users, {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
    }],
  })),
  
  updateUser: (userId, updates) => set((state) => ({
    users: state.users.map((user) =>
      user.id === userId ? { ...user, ...updates } : user
    ),
  })),
  
  deleteUser: (userId) => set((state) => ({
    users: state.users.filter((user) => user.id !== userId),
  })),
  
  toggleUserStatus: (userId) => set((state) => ({
    users: state.users.map((user) =>
      user.id === userId ? { ...user, isActive: !user.isActive } : user
    ),
  })),
  
  // Team actions
  addTeam: (team) => set((state) => ({
    teams: [...state.teams, { ...team, id: `team-${Date.now()}`, createdAt: new Date() }],
  })),
  
  updateTeam: (teamId, updates) => set((state) => ({
    teams: state.teams.map((team) =>
      team.id === teamId ? { ...team, ...updates } : team
    ),
  })),
  
  deleteTeam: (teamId) => set((state) => ({
    teams: state.teams.filter((team) => team.id !== teamId),
  })),
  
  // Automation actions
  addAutomation: (automation) => set((state) => ({
    automations: [...state.automations, {
      ...automation,
      id: `auto-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
  })),
  
  updateAutomation: (automationId, updates) => set((state) => ({
    automations: state.automations.map((automation) =>
      automation.id === automationId 
        ? { ...automation, ...updates, updatedAt: new Date() } 
        : automation
    ),
  })),
  
  deleteAutomation: (automationId) => set((state) => ({
    automations: state.automations.filter((automation) => automation.id !== automationId),
  })),
  
  toggleAutomationStatus: (automationId) => set((state) => ({
    automations: state.automations.map((automation) =>
      automation.id === automationId 
        ? { ...automation, isActive: !automation.isActive, updatedAt: new Date() } 
        : automation
    ),
  })),
  
  // Message actions
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}`,
      createdAt: new Date(),
    };
    
    set((state) => ({
      messages: [...state.messages, newMessage],
      conversations: state.conversations.map((conv) =>
        conv.id === message.conversationId
          ? { ...conv, lastMessageAt: new Date() }
          : conv
      ),
    }));
  },
  
  markConversationAsRead: (conversationId) => set((state) => ({
    conversations: state.conversations.map((conv) =>
      conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
    ),
  })),
}));
