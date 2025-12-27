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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-w-[44px] transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-2xs mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
