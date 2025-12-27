import { Search, Command, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

const TopBar = () => {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-6" role="banner">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl" role="search">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar leads, conversas, tarefas..."
            className="pl-9 pr-20 h-10 bg-background"
            aria-label="Buscar leads, conversas e tarefas"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded" aria-hidden="true">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Settings */}
      <nav className="flex items-center gap-3" aria-label="Navegação secundária">
        <Link 
          to="/settings"
          className="p-2 rounded-lg hover:bg-muted transition-colors focusable"
          aria-label="Ir para configurações"
        >
          <Settings className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
};

export default TopBar;
