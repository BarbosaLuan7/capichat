import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

type Permission = 
  | 'manage_users'
  | 'manage_teams'
  | 'manage_settings'
  | 'view_all_leads'
  | 'view_team_leads'
  | 'view_own_leads'
  | 'manage_labels'
  | 'manage_automations'
  | 'view_reports'
  | 'manage_templates';

const rolePermissions: Record<AppRole, Permission[]> = {
  admin: [
    'manage_users',
    'manage_teams',
    'manage_settings',
    'view_all_leads',
    'manage_labels',
    'manage_automations',
    'view_reports',
    'manage_templates',
  ],
  manager: [
    'view_team_leads',
    'view_reports',
    'manage_labels',
    'manage_templates',
  ],
  agent: [
    'view_own_leads',
  ],
  viewer: [],
};

export const hasPermission = (role: AppRole, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

export const canManageUsers = (role: AppRole): boolean => hasPermission(role, 'manage_users');
export const canManageTeams = (role: AppRole): boolean => hasPermission(role, 'manage_teams');
export const canViewAllLeads = (role: AppRole): boolean => hasPermission(role, 'view_all_leads');
export const canViewReports = (role: AppRole): boolean => hasPermission(role, 'view_reports') || role === 'admin';

// Labels para exibição
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  agent: 'Atendente',
  viewer: 'Visualizador',
};

// Descrições detalhadas de cada role
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: 'Acesso completo. Permite ao usuário alterar todas as configurações do sistema e visualizar todos os atendimentos, sem restrições.',
  manager: 'Acesso de gerente. Permite gerenciar equipes, visualizar relatórios e supervisionar atendimentos.',
  agent: 'Acesso com limitações. Permite visualizar indicadores e configurações, e interagir com os atendimentos das equipes sob sua responsabilidade.',
  viewer: 'Apenas visualização. Pode ver dados mas não pode realizar ações.',
};

// Cores para badges de roles
export const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  manager: 'bg-warning text-warning-foreground',
  agent: 'bg-secondary text-secondary-foreground',
  viewer: 'bg-muted text-muted-foreground',
};

// Roles disponíveis para seleção
export const SELECTABLE_ROLES: AppRole[] = ['admin', 'manager', 'agent', 'viewer'];

export const getRoleLabel = (role: AppRole): string => {
  return ROLE_LABELS[role] || role;
};

export const getRoleDescription = (role: AppRole): string => {
  return ROLE_DESCRIPTIONS[role] || '';
};

export const getRoleColor = (role: AppRole): string => {
  return ROLE_COLORS[role] || 'bg-muted text-muted-foreground';
};
