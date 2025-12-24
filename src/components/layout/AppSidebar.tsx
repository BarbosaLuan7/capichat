import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Kanban,
  CheckSquare,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Scale,
  UsersRound,
  UserCog,
  Workflow,
  Zap,
  Tags,
  FileText,
  Webhook,
  MessageCircle,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  badgeKey?: 'conversations' | 'tasks';
  children?: { icon: any; label: string; path: string }[];
}

const menuItemsConfig: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MessageSquare, label: 'Conversas', path: '/inbox', badgeKey: 'conversations' },
  { icon: Kanban, label: 'Funil', path: '/funnel' },
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks', badgeKey: 'tasks' },
  { icon: Calendar, label: 'Calendário', path: '/calendar' },
  { icon: Workflow, label: 'Automações', path: '/automations' },
  { icon: Zap, label: 'Chatbot', path: '/chatbot' },
  { icon: BarChart3, label: 'Métricas', path: '/metrics' },
  {
    icon: Settings,
    label: 'Configurações',
    path: '/settings',
    children: [
      { icon: UserCog, label: 'Usuários', path: '/settings/users' },
      { icon: UsersRound, label: 'Equipes', path: '/settings/teams' },
      { icon: Tags, label: 'Etiquetas', path: '/settings/labels' },
      { icon: FileText, label: 'Templates', path: '/settings/templates' },
      { icon: Webhook, label: 'Webhooks', path: '/settings/webhooks' },
      { icon: MessageCircle, label: 'WhatsApp', path: '/settings/whatsapp' },
      { icon: Key, label: 'API', path: '/settings/api' },
    ],
  },
];

const AppSidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  );
  const badges = useSidebarBadges();

  // Memoize menu items with dynamic badges
  const menuItems = useMemo(() => {
    return menuItemsConfig.map((item) => ({
      ...item,
      badge: item.badgeKey ? badges[item.badgeKey] : undefined,
    }));
  }, [badges]);

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: typeof menuItems[0]) => {
    if (item.children) {
      return location.pathname.startsWith(item.path);
    }
    return location.pathname === item.path;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen gradient-sidebar flex flex-col border-r border-sidebar-border sticky top-0"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">
                GaranteDireito
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          const parentActive = isParentActive(item);

          // Item with children (submenu)
          if (item.children && !sidebarCollapsed) {
            return (
              <Collapsible
                key={item.path}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                      parentActive
                        ? 'bg-sidebar-accent text-sidebar-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium whitespace-nowrap flex-1 text-left">
                      {item.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform',
                        settingsOpen && 'rotate-180'
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 mt-1 space-y-1">
                  {item.children.map((child) => {
                    const childActive = isActive(child.path);
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                          childActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <child.icon className="w-4 h-4" />
                        <span className="text-sm">{child.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          // Regular menu item
          const linkContent = (
            <Link
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-visible',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', active && 'animate-pulse-ring')} />
              
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {item.badge && (
                <span
                  className={cn(
                    'flex items-center justify-center font-bold rounded-full',
                    sidebarCollapsed
                      ? 'absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] bg-destructive text-destructive-foreground shadow-sm'
                      : 'ml-auto w-6 h-6 text-xs bg-destructive/20 text-destructive'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                  {item.badge && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded">
                      {item.badge}
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.path}>{linkContent}</div>;
        })}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <Avatar className="w-10 h-10 border-2 border-sidebar-accent">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
              {user?.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="font-medium text-sidebar-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.role === 'admin'
                    ? 'Administrador'
                    : user?.role === 'manager'
                    ? 'Gestor'
                    : 'Atendente'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!sidebarCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
