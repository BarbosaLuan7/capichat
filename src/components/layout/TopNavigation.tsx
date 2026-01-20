import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Kanban,
  CheckSquare,
  Calendar,
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
  User,
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
  NavigationMenuItem,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { TenantSelector } from '@/components/tenants/TenantSelector';

// Primary items - always visible on md+ (Conversas, Funil)
const primaryNavItems = [
  { icon: MessageSquare, label: 'Conversas', path: '/inbox', badgeKey: 'conversations' as const },
  { icon: Kanban, label: 'Funil', path: '/funnel' },
];

// CRM items - visible for all users
const crmItems = [
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks', badgeKey: 'tasks' as const },
  { icon: Calendar, label: 'Calendário', path: '/calendar' },
];

// Tools items - visible for all users
const toolsItems = [
  { icon: Tags, label: 'Etiquetas', path: '/settings/labels' },
  { icon: FileText, label: 'Templates', path: '/settings/templates' },
  { icon: Workflow, label: 'Automações', path: '/automations' },
  { icon: Zap, label: 'Chatbot', path: '/chatbot' },
];

// Admin-only settings items - only visible for account owners
const adminSettingsItems = [
  { icon: UserCog, label: 'Usuários', path: '/settings/users' },
  { icon: UsersRound, label: 'Equipes', path: '/settings/teams' },
  { icon: Webhook, label: 'Webhooks', path: '/settings/webhooks' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/settings/whatsapp' },
  { icon: Key, label: 'API', path: '/settings/api' },
  { icon: Scale, label: 'Empresas', path: '/settings/tenants' },
];

const TopNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser: user, signOut, isAccountOwner } = useAuth();
  const badges = useSidebarBadges();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (items: { path: string }[]) =>
    items.some((item) => location.pathname.startsWith(item.path));

  // Mobile menu content - reorganized with Dashboard in secondary section
  const MobileMenuContent = () => (
    <div className="flex flex-col gap-6 p-4">
      {/* Primary items - Conversas, Funil */}
      <div className="space-y-1">
        {primaryNavItems.map((item) => {
          const active = isActive(item.path);
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground hover:bg-primary/10 hover:text-foreground'
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <Badge className="ml-1 h-5 min-w-5 border-0 bg-warning px-1 text-xs text-warning-foreground hover:bg-warning">
                  {badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>

      {/* CRM */}
      <div className="space-y-2">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          CRM
        </p>
        <div className="space-y-1">
          {crmItems.map((item) => {
            const active = isActive(item.path);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-primary/10 hover:text-foreground'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 border-0 bg-warning px-1 text-xs text-warning-foreground hover:bg-warning">
                    {badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Dashboard - only for account owners */}
      {isAccountOwner && (
        <div className="space-y-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Visão Geral
          </p>
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive('/dashboard')
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground hover:bg-primary/10 hover:text-foreground'
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      )}

      {/* Tools */}
      <div className="space-y-2">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ferramentas
        </p>
        <div className="space-y-1">
          {toolsItems.map((item) => {
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-primary/10 hover:text-foreground'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Admin Settings - only for account owners */}
      {isAccountOwner && (
        <div className="space-y-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configurações
          </p>
          <div className="space-y-1">
            {adminSettingsItems.map((item) => {
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-primary/10 hover:text-foreground'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <header
      className="sticky top-0 z-50 flex h-16 items-center border-b border-sidebar-border bg-sidebar px-4"
      role="banner"
    >
      {/* Logo */}
      <Link to="/inbox" className="mr-4 flex shrink-0 items-center gap-2.5">
        <img src={lbAdvLogo} alt="LB ADV" className="h-14 w-14 object-contain" />
        <span className="hidden text-lg font-bold text-white sm:block">LB ADV</span>
      </Link>

      {/* Tenant Selector */}
      <div className="mr-4 hidden md:block">
        <TenantSelector />
      </div>

      {/* Primary Navigation - Always visible on md+ (Conversas, Funil) */}
      <NavigationMenu className="hidden md:flex">
        <NavigationMenuList className="gap-1">
          {primaryNavItems.map((item) => {
            const active = isActive(item.path);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

            return (
              <NavigationMenuItem key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <Badge className="ml-1 h-5 min-w-5 border-0 bg-warning px-1 text-xs text-warning-foreground hover:bg-warning">
                      {badge}
                    </Badge>
                  )}
                </Link>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>

      {/* CRM Items - Inline for non-account owners, Dropdown for account owners */}
      <div className="hidden items-center md:flex">
        {isAccountOwner ? (
          // Dropdown for account owners (more compact)
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white',
                  isGroupActive(crmItems) && 'bg-white/20 text-white'
                )}
              >
                <Users className="mr-2 h-4 w-4" />
                CRM
                {badges.tasks > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 border-0 bg-warning px-1 text-xs text-warning-foreground hover:bg-warning">
                    {badges.tasks}
                  </Badge>
                )}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {crmItems.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <Link to={item.path} className="flex cursor-pointer items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.badgeKey && badges[item.badgeKey] > 0 && (
                      <Badge className="h-5 min-w-5 border-0 bg-warning px-1 text-xs text-warning-foreground">
                        {badges[item.badgeKey]}
                      </Badge>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Inline items for regular users - better distribution
          <NavigationMenu>
            <NavigationMenuList className="gap-1">
              {crmItems.map((item) => {
                const active = isActive(item.path);
                const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

                return (
                  <NavigationMenuItem key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-white text-primary shadow-sm'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <Badge className="ml-1 h-5 min-w-5 border-0 bg-warning px-1 text-xs text-warning-foreground hover:bg-warning">
                          {badge}
                        </Badge>
                      )}
                    </Link>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        )}
      </div>

      {/* Secondary Navigation - Only visible on lg+ */}
      <div className="hidden items-center lg:flex">
        {/* Dashboard Link - only for account owners */}
        {isAccountOwner && (
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              isActive('/dashboard')
                ? 'bg-white text-primary shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        )}

        {/* Tools Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white',
                isGroupActive(toolsItems) && 'bg-white/20 text-white'
              )}
            >
              <Workflow className="mr-2 h-4 w-4" />
              Ferramentas
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {toolsItems.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                <Link to={item.path} className="flex cursor-pointer items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Admin Settings Dropdown - only for account owners */}
        {isAccountOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white',
                  isGroupActive(adminSettingsItems) && 'bg-white/20 text-white'
                )}
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurações
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {adminSettingsItems.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <Link to={item.path} className="flex cursor-pointer items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search - Desktop */}
        <div className="hidden items-center md:flex">
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="h-9 w-64 bg-white pl-9 pr-8"
                autoFocus
                onBlur={() => setSearchOpen(false)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearchOpen(false)}
                aria-label="Fechar busca"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Notifications */}
        <div className="[&_button]:text-white/70 [&_button]:hover:bg-white/10 [&_button]:hover:text-white">
          <NotificationCenter userId={user?.id} />
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-white/10">
              <Avatar className="h-8 w-8 ring-2 ring-white/20">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-white/20 text-sm text-white">
                  {user?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/account')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Minha Conta</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            {/* Mobile Header - LB ADV theme */}
            <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border bg-sidebar px-4">
              <img src={lbAdvLogo} alt="LB ADV" className="h-10 w-10 object-contain" />
              <span className="text-base font-bold text-white">LB ADV</span>
            </div>
            {/* Mobile Menu */}
            <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
              <MobileMenuContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default TopNavigation;
