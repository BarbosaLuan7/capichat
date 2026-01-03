import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  Search,
  Menu,
  X,
} from 'lucide-react';
import lbAdvLogo from '@/assets/lb-adv-logo.svg';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { TenantSelector } from '@/components/tenants/TenantSelector';

// Menu structure
const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MessageSquare, label: 'Conversas', path: '/inbox', badgeKey: 'conversations' as const },
  { icon: Kanban, label: 'Funil', path: '/funnel' },
];

const crmItems = [
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks', badgeKey: 'tasks' as const },
  { icon: Calendar, label: 'Calendário', path: '/calendar' },
];

const toolsItems = [
  { icon: Workflow, label: 'Automações', path: '/automations' },
  { icon: Zap, label: 'Chatbot', path: '/chatbot' },
  { icon: BarChart3, label: 'Métricas', path: '/metrics' },
];

const settingsItems = [
  { icon: UserCog, label: 'Usuários', path: '/settings/users' },
  { icon: UsersRound, label: 'Equipes', path: '/settings/teams' },
  { icon: Tags, label: 'Etiquetas', path: '/settings/labels' },
  { icon: FileText, label: 'Templates', path: '/settings/templates' },
  { icon: Webhook, label: 'Webhooks', path: '/settings/webhooks' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/settings/whatsapp' },
  { icon: Key, label: 'API', path: '/settings/api' },
  { icon: Scale, label: 'Empresas', path: '/settings/tenants' },
];

const TopNavigation = () => {
  const location = useLocation();
  const { authUser: user, signOut } = useAuth();
  const badges = useSidebarBadges();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (items: { path: string }[]) => 
    items.some(item => location.pathname.startsWith(item.path));

  const NavItem = ({ 
    item, 
    className 
  }: { 
    item: { icon: any; label: string; path: string; badgeKey?: 'conversations' | 'tasks' }; 
    className?: string;
  }) => {
    const active = isActive(item.path);
    const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
    
    return (
      <Link
        to={item.path}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          active
            ? 'bg-white text-primary shadow-sm'
            : 'text-white/80 hover:text-white hover:bg-white/10',
          className
        )}
        onClick={() => setMobileMenuOpen(false)}
      >
        <item.icon className="w-4 h-4" />
        <span>{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <Badge className="ml-1 h-5 min-w-5 px-1 text-xs bg-warning text-warning-foreground border-0 hover:bg-warning">
            {badge}
          </Badge>
        )}
      </Link>
    );
  };

  const DropdownNavItem = ({
    item,
  }: {
    item: { icon: any; label: string; path: string; badgeKey?: 'conversations' | 'tasks' };
  }) => {
    const active = isActive(item.path);
    const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
    const Icon = item.icon;
    
    return (
      <Link
        to={item.path}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          active
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-slate-700 hover:bg-primary/5'
        )}
        onClick={() => setMobileMenuOpen(false)}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <Badge className="h-5 min-w-5 px-1 text-xs bg-warning text-warning-foreground border-0 hover:bg-warning">
            {badge}
          </Badge>
        )}
      </Link>
    );
  };

  // Mobile menu content
  const MobileMenuContent = () => (
    <div className="flex flex-col gap-6 p-4">
      {/* Main items */}
      <div className="space-y-1">
        {mainNavItems.map((item) => {
          const active = isActive(item.path);
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
          
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-primary/10'
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <Badge className="ml-1 h-5 min-w-5 px-1 text-xs bg-warning text-warning-foreground border-0 hover:bg-warning">
                  {badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>

      {/* CRM */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">CRM</p>
        <div className="space-y-1">
          {crmItems.map((item) => {
            const active = isActive(item.path);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-primary/10'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 px-1 text-xs bg-warning text-warning-foreground border-0 hover:bg-warning">
                    {badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Ferramentas</p>
        <div className="space-y-1">
          {toolsItems.map((item) => {
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-primary/10'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Configurações</p>
        <div className="space-y-1">
          {settingsItems.map((item) => {
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-primary/10'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <header className="h-16 bg-[#0b305b] border-b border-[#0a2847] flex items-center px-4 sticky top-0 z-50" role="banner">
      {/* Logo */}
      <Link to="/inbox" className="flex items-center gap-2.5 mr-4 shrink-0">
        <img 
          src={lbAdvLogo} 
          alt="LB ADV" 
          className="h-15 w-15 object-contain"
        />
        <span className="text-lg font-bold text-white hidden sm:block">
          LB ADV
        </span>
      </Link>

      {/* Tenant Selector */}
      <div className="hidden md:block mr-4">
        <TenantSelector />
      </div>

      {/* Desktop Navigation */}
      <NavigationMenu className="hidden lg:flex">
        <NavigationMenuList className="gap-1">
          {/* Main items */}
          {mainNavItems.map((item) => {
            const active = isActive(item.path);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            
            return (
              <NavigationMenuItem key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <Badge className="ml-1 h-5 min-w-5 px-1 text-xs bg-warning text-warning-foreground border-0 hover:bg-warning">
                      {badge}
                    </Badge>
                  )}
                </Link>
              </NavigationMenuItem>
            );
          })}

          {/* CRM Dropdown */}
          <NavigationMenuItem>
            <NavigationMenuTrigger 
              className={cn(
                'px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 bg-transparent data-[state=open]:bg-white/20',
                isGroupActive(crmItems) && 'bg-white/20 text-white'
              )}
            >
              <Users className="w-4 h-4 mr-2" />
              CRM
              {badges.tasks > 0 && (
                <Badge className="ml-1 h-5 min-w-5 px-1 text-xs bg-warning text-warning-foreground border-0 hover:bg-warning">
                  {badges.tasks}
                </Badge>
              )}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="w-56 p-2">
                {crmItems.map((item) => (
                  <DropdownNavItem key={item.path} item={item} />
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>

          {/* Tools Dropdown */}
          <NavigationMenuItem>
            <NavigationMenuTrigger 
              className={cn(
                'px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 bg-transparent data-[state=open]:bg-white/20',
                isGroupActive(toolsItems) && 'bg-white/20 text-white'
              )}
            >
              <Workflow className="w-4 h-4 mr-2" />
              Ferramentas
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="w-56 p-2">
                {toolsItems.map((item) => (
                  <DropdownNavItem key={item.path} item={item} />
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>

          {/* Settings Dropdown */}
          <NavigationMenuItem>
            <NavigationMenuTrigger 
              className={cn(
                'px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 bg-transparent data-[state=open]:bg-white/20',
                isGroupActive(settingsItems) && 'bg-white/20 text-white'
              )}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="w-56 p-2">
                {settingsItems.map((item) => (
                  <DropdownNavItem key={item.path} item={item} />
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      {/* Spacer for mobile */}
      <div className="flex-1 lg:hidden" />

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Search - Desktop */}
        <div className="hidden md:flex items-center">
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="w-64 pl-9 pr-8 h-9 bg-white"
                autoFocus
                onBlur={() => setSearchOpen(false)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchOpen(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Notifications */}
        <div className="[&_button]:text-white/70 [&_button]:hover:text-white [&_button]:hover:bg-white/10">
          <NotificationCenter userId={user?.id} />
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-white/10">
              <Avatar className="h-8 w-8 ring-2 ring-white/20">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-white/20 text-white text-sm">
                  {user?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/users" className="cursor-pointer">
                <UserCog className="mr-2 h-4 w-4" />
                <span>Minha conta</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden text-white/80 hover:text-white hover:bg-white/10">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            {/* Mobile Header */}
            <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border bg-gradient-to-r from-violet-700 via-purple-700 to-violet-800">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-white">
                GaranteDireito
              </span>
            </div>
            {/* Mobile Menu */}
            <div className="overflow-y-auto h-[calc(100vh-3.5rem)]">
              <MobileMenuContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default TopNavigation;
