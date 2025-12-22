import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRecentAutomationLogs, useAutomationStats } from '@/hooks/useAutomationLogs';
import { useAutomations } from '@/hooks/useAutomations';
import { cn } from '@/lib/utils';

const statusConfig = {
  success: {
    icon: CheckCircle2,
    label: 'Sucesso',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  failed: {
    icon: XCircle,
    label: 'Falhou',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  skipped: {
    icon: AlertCircle,
    label: 'Ignorado',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  pending: {
    icon: Clock,
    label: 'Pendente',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
};

const triggerLabels: Record<string, string> = {
  lead_created: 'Lead criado',
  lead_stage_changed: 'Etapa alterada',
  lead_temperature_changed: 'Temperatura alterada',
  lead_no_response: 'Sem resposta',
  lead_label_added: 'Etiqueta adicionada',
  task_overdue: 'Tarefa vencida',
  conversation_no_response: 'Conversa sem resposta',
};

const actionLabels: Record<string, string> = {
  move_lead_to_stage: 'Mover lead',
  change_lead_temperature: 'Alterar temperatura',
  add_label: 'Adicionar etiqueta',
  remove_label: 'Remover etiqueta',
  create_task: 'Criar tarefa',
  notify_user: 'Notificar',
  assign_to_user: 'Atribuir',
  send_message: 'Enviar mensagem',
};

interface LogItemProps {
  log: {
    id: string;
    trigger_event: string;
    status: 'pending' | 'success' | 'failed' | 'skipped';
    conditions_met: boolean;
    conditions_evaluated: Array<{
      field: string;
      operator: string;
      value: string;
      result: boolean;
    }>;
    actions_executed: Array<{
      type: string;
      params: Record<string, string>;
      success: boolean;
      error?: string;
    }>;
    error_message: string | null;
    execution_time_ms: number | null;
    created_at: string;
    automations: { name: string } | null;
  };
}

const LogItem = ({ log }: LogItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = statusConfig[log.status];
  const StatusIcon = config.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bg)}>
            <StatusIcon className={cn('w-4 h-4', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {log.automations?.name || 'Automação removida'}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                {triggerLabels[log.trigger_event] || log.trigger_event}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}</span>
              {log.execution_time_ms && (
                <>
                  <span>·</span>
                  <span>{log.execution_time_ms}ms</span>
                </>
              )}
            </div>
          </div>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="pl-11 pr-3 pb-3 space-y-3"
        >
          {/* Conditions */}
          {log.conditions_evaluated && log.conditions_evaluated.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Condições avaliadas:</p>
              <div className="space-y-1">
                {log.conditions_evaluated.map((cond, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {cond.result ? (
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      {cond.field} {cond.operator} "{cond.value}"
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {log.actions_executed && log.actions_executed.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ações executadas:</p>
              <div className="space-y-1">
                {log.actions_executed.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {action.success ? (
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                    <span>{actionLabels[action.type] || action.type}</span>
                    {action.error && (
                      <span className="text-destructive">({action.error})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {log.error_message && (
            <div className="bg-destructive/10 text-destructive text-xs p-2 rounded">
              {log.error_message}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </p>
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const AutomationExecutionLogs = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [automationFilter, setAutomationFilter] = useState<string>('all');
  
  const { data: logs = [], isLoading, refetch, isRefetching } = useRecentAutomationLogs(50);
  const { data: stats } = useAutomationStats();
  const { data: automations = [] } = useAutomations();

  const filteredLogs = logs.filter(log => {
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (automationFilter !== 'all' && log.automation_id !== automationFilter) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Execuções Recentes
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">24h:</span>
              <span className="font-medium">{stats.last24h.total}</span>
              <span className="text-success">({stats.last24h.success}✓)</span>
              {stats.last24h.failed > 0 && (
                <span className="text-destructive">({stats.last24h.failed}✗)</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">7d:</span>
              <span className="font-medium">{stats.last7d.total}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 pt-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="skipped">Ignorado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={automationFilter} onValueChange={setAutomationFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Automação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas automações</SelectItem>
              {automations.map(auto => (
                <SelectItem key={auto.id} value={auto.id}>{auto.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length > 0 ? (
            <AnimatePresence>
              <div className="space-y-1">
                {filteredLogs.map((log) => (
                  <LogItem key={log.id} log={log} />
                ))}
              </div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Nenhuma execução ainda</p>
              <p className="text-sm text-muted-foreground">
                As execuções aparecerão aqui quando as automações forem acionadas
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
