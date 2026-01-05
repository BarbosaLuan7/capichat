import { memo } from 'react';
import { MessageCircle, Search, Inbox, FileText, Tag, Users, Filter, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  type: 'conversations' | 'messages' | 'search' | 'notes' | 'labels' | 'team' | 'filtered' | 'no-pending' | 'no-open' | 'no-resolved';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const emptyStateConfig = {
  conversations: {
    icon: Inbox,
    title: 'Nenhuma conversa ainda',
    description: 'Clique em "+ Nova conversa" para iniciar um atendimento',
    iconColor: 'text-primary',
  },
  messages: {
    icon: MessageCircle,
    title: 'Nenhuma mensagem',
    description: 'Envie a primeira mensagem para iniciar a conversa',
    iconColor: 'text-muted-foreground',
  },
  search: {
    icon: Search,
    title: 'Nenhum resultado encontrado',
    description: 'Tente buscar com outros termos ou limpe os filtros',
    iconColor: 'text-muted-foreground',
  },
  notes: {
    icon: FileText,
    title: 'Nenhuma nota interna',
    description: 'Adicione notas para registrar informações importantes',
    iconColor: 'text-muted-foreground',
  },
  labels: {
    icon: Tag,
    title: 'Nenhuma etiqueta',
    description: 'Crie etiquetas para organizar seus leads',
    iconColor: 'text-muted-foreground',
  },
  team: {
    icon: Users,
    title: 'Nenhum membro na equipe',
    description: 'Adicione membros para colaborar no atendimento',
    iconColor: 'text-muted-foreground',
  },
  filtered: {
    icon: Filter,
    title: 'Nenhum resultado',
    description: 'Tente ajustar seus filtros para encontrar conversas',
    iconColor: 'text-muted-foreground',
  },
  'no-pending': {
    icon: CheckCircle2,
    title: 'Nenhuma conversa pendente',
    description: 'Todas as conversas foram lidas. Bom trabalho!',
    iconColor: 'text-success',
  },
  'no-open': {
    icon: MessageCircle,
    title: 'Nenhuma conversa aberta',
    description: 'Não há conversas em atendimento no momento',
    iconColor: 'text-muted-foreground',
  },
  'no-resolved': {
    icon: Clock,
    title: 'Nenhuma conversa resolvida',
    description: 'Resolva conversas para vê-las aqui',
    iconColor: 'text-muted-foreground',
  },
};

function EmptyStateComponent({ 
  type, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className={cn(
        "w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4",
        config.iconColor
      )}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1">
        {title || config.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">
        {description || config.description}
      </p>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export const EmptyState = memo(EmptyStateComponent);
