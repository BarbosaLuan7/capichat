import { useState } from 'react';
import { Search, Command, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useAuth } from '@/hooks/useAuth';

const TopBar = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads, conversas, tarefas..."
            className="pl-9 pr-20 h-10 bg-background"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Lead</span>
        </Button>

        {/* Notifications */}
        <NotificationCenter userId={user?.id} />
      </div>
    </header>
  );
};

export default TopBar;
