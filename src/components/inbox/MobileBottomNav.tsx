import { cn } from '@/lib/utils';
import { Home, MessageSquare, Users, Calendar, Settings } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

const navItems = [
  { href: '/', icon: Home, label: 'Início' },
  { href: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { href: '/leads', icon: Users, label: 'Leads' },
  { href: '/calendar', icon: Calendar, label: 'Agenda' },
  { href: '/settings', icon: Settings, label: 'Config' },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="safe-area-pb fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex h-full min-w-[44px] flex-1 flex-col items-center justify-center transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-2xs mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
