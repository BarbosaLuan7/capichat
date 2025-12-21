export type UserRole = 'admin' | 'manager' | 'agent' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  teamId?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Team {
  id: string;
  name: string;
  supervisorId: string;
  memberIds: string[];
  createdAt: Date;
}

export type LeadTemperature = 'cold' | 'warm' | 'hot';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  source: string;
  stageId: string;
  temperature: LeadTemperature;
  assignedTo: string;
  labelIds: string[];
  estimatedValue?: number;
  customFields?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus = 'open' | 'pending' | 'resolved';

export interface Conversation {
  id: string;
  leadId: string;
  status: ConversationStatus;
  assignedTo: string;
  lastMessageAt: Date;
  unreadCount: number;
  createdAt: Date;
}

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type SenderType = 'lead' | 'agent';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: SenderType;
  content: string;
  type: MessageType;
  status: MessageStatus;
  mediaUrl?: string;
  createdAt: Date;
}

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  leadId?: string;
  assignedTo: string;
  dueDate?: Date;
  priority: TaskPriority;
  status: TaskStatus;
  labelIds?: string[];
  subtasks?: Subtask[];
  createdAt: Date;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export type LabelCategory = 'origem' | 'interesse' | 'prioridade' | 'status';

export interface Label {
  id: string;
  name: string;
  color: string;
  category: LabelCategory;
}

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  shortcut: string;
  createdAt: Date;
}

export interface InternalNote {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}
