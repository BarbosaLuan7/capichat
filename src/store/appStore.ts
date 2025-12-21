import { create } from 'zustand';
import { Lead, Conversation, Message, Task, Label, FunnelStage } from '@/types';
import { 
  mockLeads, 
  mockConversations, 
  mockMessages, 
  mockTasks, 
  mockLabels, 
  mockFunnelStages 
} from '@/data/mockData';

interface AppState {
  // Data
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  tasks: Task[];
  labels: Label[];
  funnelStages: FunnelStage[];
  
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
  
  // Message actions
  addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => void;
  markConversationAsRead: (conversationId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial data
  leads: mockLeads,
  conversations: mockConversations,
  messages: mockMessages,
  tasks: mockTasks,
  labels: mockLabels,
  funnelStages: mockFunnelStages,
  
  // Selected items
  selectedConversationId: null,
  selectedLeadId: null,
  
  // UI State
  sidebarCollapsed: false,
  
  // Actions
  setSelectedConversation: (id) => set({ selectedConversationId: id }),
  setSelectedLead: (id) => set({ selectedLeadId: id }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
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
