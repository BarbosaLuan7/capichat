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
  BarChart3,
  Settings,
  Plus,
  Search,
  User,
  Phone,
} from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';

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
    { icon: BarChart3, label: 'Métricas', path: '/metrics' },
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
