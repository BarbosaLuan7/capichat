import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  MessageSquare,
  GitBranch,
  Users,
  CheckSquare,
  CalendarDays,
  Zap,
  Bot,
  
  Settings,
  Plus,
  Search,
  User,
  Phone,
  FileText,
} from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewLead?: () => void;
  onNewTask?: () => void;
}

export function CommandBar({ open, onOpenChange, onNewLead, onNewTask }: CommandBarProps) {
  const navigate = useNavigate();
  const { data: leadsData } = useLeads();
  const { data: tasksData } = useTasks();
  const leads = leadsData?.leads || [];
  const tasks = tasksData?.tasks || [];
  const [search, setSearch] = useState('');
  
  // Search messages when search term is >= 3 chars
  const { data: messageResults = [], isLoading: isSearchingMessages } = useMessageSearch(search, open);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  // Navigation items
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'Inbox', path: '/inbox' },
    { icon: GitBranch, label: 'Funil', path: '/funnel' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: CheckSquare, label: 'Tarefas', path: '/tasks' },
    { icon: CalendarDays, label: 'Calendário', path: '/calendar' },
    { icon: Zap, label: 'Automações', path: '/automations' },
    { icon: Bot, label: 'Chatbot', path: '/chatbot' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  // Quick actions
  const quickActions = [
    { icon: Plus, label: 'Novo Lead', action: () => { onNewLead?.(); onOpenChange(false); } },
    { icon: Plus, label: 'Nova Tarefa', action: () => { onNewTask?.(); onOpenChange(false); } },
  ];

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!search || search.length < 2) return [];
    const lowerSearch = search.toLowerCase();
    return leads
      .filter((lead) =>
        lead.name.toLowerCase().includes(lowerSearch) ||
        lead.phone.includes(lowerSearch) ||
        lead.email?.toLowerCase().includes(lowerSearch)
      )
      .slice(0, 5);
  }, [leads, search]);

  // Filter tasks by search
  const filteredTasks = useMemo(() => {
    if (!search || search.length < 2) return [];
    const lowerSearch = search.toLowerCase();
    return tasks
      .filter((task) =>
        task.title.toLowerCase().includes(lowerSearch) ||
        task.description?.toLowerCase().includes(lowerSearch)
      )
      .slice(0, 5);
  }, [tasks, search]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleSelectLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
    onOpenChange(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    navigate(`/inbox?conversation=${conversationId}`);
    onOpenChange(false);
  };

  // Highlight search term in text
  const highlightText = (text: string, term: string) => {
    if (!term || term.length < 3) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-primary/20 text-primary px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Truncate message content around the search term
  const truncateContent = (content: string, term: string, maxLength = 60) => {
    const index = content.toLowerCase().indexOf(term.toLowerCase());
    if (index === -1) return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
    
    const start = Math.max(0, index - 20);
    const end = Math.min(content.length, index + term.length + 40);
    let result = content.slice(start, end);
    if (start > 0) result = '...' + result;
    if (end < content.length) result = result + '...';
    return result;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar leads, tarefas, navegar..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Leads encontrados */}
        {filteredLeads.length > 0 && (
          <CommandGroup heading="Leads">
            {filteredLeads.map((lead) => (
              <CommandItem
                key={lead.id}
                onSelect={() => handleSelectLead(lead.id)}
                className="flex items-center gap-3"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="font-medium">{lead.name}</span>
                  <span className="ml-2 text-muted-foreground text-sm">{lead.phone}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {lead.temperature === 'hot' ? '🔥' : lead.temperature === 'warm' ? '🌡️' : '❄️'}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Tarefas encontradas */}
        {filteredTasks.length > 0 && (
          <CommandGroup heading="Tarefas">
            {filteredTasks.map((task) => (
              <CommandItem
                key={task.id}
                onSelect={() => handleNavigate('/tasks')}
                className="flex items-center gap-3"
              >
                <CheckSquare className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="font-medium">{task.title}</span>
                </div>
                <Badge
                  variant={task.status === 'done' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {task.status === 'done' ? 'Concluída' : task.status === 'in_progress' ? 'Em Progresso' : 'Pendente'}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Mensagens encontradas */}
        {messageResults.length > 0 && (
          <CommandGroup heading="Mensagens">
            {messageResults.map((result) => (
              <CommandItem
                key={result.messageId}
                onSelect={() => handleSelectConversation(result.conversationId)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm">{result.leadName}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(result.createdAt), 'dd/MM HH:mm', { locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground ml-6 line-clamp-1">
                  {highlightText(truncateContent(result.content, search), search)}
                </p>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Loading state for message search */}
        {isSearchingMessages && search.length >= 3 && (
          <CommandGroup heading="Mensagens">
            <CommandItem disabled className="text-muted-foreground">
              <Search className="w-4 h-4 mr-2 animate-pulse" />
              Buscando mensagens...
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Ações rápidas */}
        <CommandGroup heading="Ações Rápidas">
          {quickActions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={action.action}
              className="flex items-center gap-3"
            >
              <action.icon className="w-4 h-4" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        {/* Navegação */}
        <CommandGroup heading="Navegação">
          {navItems.map((item) => (
            <CommandItem
              key={item.path}
              onSelect={() => handleNavigate(item.path)}
              className="flex items-center gap-3"
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
