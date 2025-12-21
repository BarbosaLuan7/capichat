import { UserRole } from '@/types';

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

const rolePermissions: Record<UserRole, Permission[]> = {
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

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

export const canManageUsers = (role: UserRole): boolean => hasPermission(role, 'manage_users');
export const canManageTeams = (role: UserRole): boolean => hasPermission(role, 'manage_teams');
export const canViewAllLeads = (role: UserRole): boolean => hasPermission(role, 'view_all_leads');
export const canViewReports = (role: UserRole): boolean => hasPermission(role, 'view_reports') || role === 'admin';

export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    manager: 'Gestor',
    agent: 'Atendente',
    viewer: 'Visualizador',
  };
  return labels[role];
};
