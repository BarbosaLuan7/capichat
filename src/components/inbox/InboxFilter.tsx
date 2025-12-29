import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Settings } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface InboxItem {
  id: string;
  name: string;
  phone_number: string | null;
  conversationCount: number;
}

interface InboxFilterProps {
  inboxes: InboxItem[];
  selectedInboxIds: string[];
  onToggleInbox: (inboxId: string) => void;
  onSelectAll: () => void;
}

export function InboxFilter({
  inboxes,
  selectedInboxIds,
  onToggleInbox,
  onSelectAll,
}: InboxFilterProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('inbox-filter-collapsed');
    if (saved !== null) {
      setIsOpen(saved !== 'true');
    }
  }, []);

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem('inbox-filter-collapsed', (!isOpen).toString());
  }, [isOpen]);

  if (inboxes.length === 0) {
    return null;
  }

  const allSelected = selectedInboxIds.length === inboxes.length;
  const noneSelected = selectedInboxIds.length === 0;

  const formatPhoneDisplay = (phone: string | null, name: string) => {
    if (phone) {
      // Format phone with country code
      if (phone.startsWith('55') && phone.length >= 12) {
        const ddd = phone.slice(2, 4);
        const number = phone.slice(4);
        if (number.length === 9) {
          return `+55 ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
        }
        return `+55 ${ddd} ${number}`;
      }
      return `+${phone}`;
    }
    return name;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Caixas de Entrada</span>
        </div>
        {!allSelected && !noneSelected && (
          <span className="text-xs text-muted-foreground">
            {selectedInboxIds.length}/{inboxes.length}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-2">
        <div className="space-y-1">
          {/* Toggle all button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onSelectAll}
          >
            {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
          </Button>

          {/* Inbox list */}
          {inboxes.map((inbox) => {
            const isSelected = selectedInboxIds.includes(inbox.id);
            return (
              <div
                key={inbox.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                  'hover:bg-accent/50',
                  isSelected && 'bg-accent/30'
                )}
                onClick={() => onToggleInbox(inbox.id)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleInbox(inbox.id)}
                  className="h-3.5 w-3.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {formatPhoneDisplay(inbox.phone_number, inbox.name)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {inbox.conversationCount}
                </span>
              </div>
            );
          })}

          {/* Link to settings */}
          <Link
            to="/settings/whatsapp"
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3 w-3" />
            <span>Configurar caixas</span>
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
