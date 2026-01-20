import { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Target,
  Zap,
  Timer,
  Download,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  useLeadMetrics,
  useFunnelMetrics,
  useAgentPerformance,
  useDailyEvolution,
  useConversationMetrics,
  type PeriodFilter,
} from '@/hooks/useMetrics';
import { useReportExport } from '@/hooks/useReportExport';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantStats } from '@/hooks/useTenantStats';
import { TenantIndicatorCard } from '@/components/dashboard/TenantIndicatorCard';

// Memoized tooltip component
const CustomTooltip = memo(({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = 'CustomTooltip';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  quarter: 'Este Trimestre',
};

const Dashboard = () => {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const { exportReport, isExporting } = useReportExport();
  const { tenants, currentTenant, setCurrentTenant, hasMultipleTenants } = useTenant();

  // Tenant stats
  const tenantIds = tenants.map((t) => t.id);
  const { data: tenantStats, isLoading: loadingTenantStats } = useTenantStats(tenantIds);

  const tenantId = currentTenant?.id || null;

  // Data hooks with refetch
  const {
    data: leadMetrics,
    isLoading: loadingLeads,
    refetch: refetchLeads,
  } = useLeadMetrics(period, tenantId);
  const {
    data: funnelMetrics,
    isLoading: loadingFunnel,
    refetch: refetchFunnel,
  } = useFunnelMetrics(period, tenantId);
  const {
    data: agentPerformance,
    isLoading: loadingAgents,
    refetch: refetchAgents,
  } = useAgentPerformance(period, tenantId);
  const {
    data: dailyEvolution,
    isLoading: loadingDaily,
    refetch: refetchDaily,
  } = useDailyEvolution(period, tenantId);
  const {
    data: conversationMetrics,
    isLoading: loadingConversations,
    refetch: refetchConversations,
  } = useConversationMetrics(period, tenantId);

  const handleRefresh = () => {
    refetchLeads();
    refetchFunnel();
    refetchAgents();
    refetchDaily();
    refetchConversations();
  };

  // KPI stats
  const stats = useMemo(
    () => [
      {
        title: 'Total de Leads',
        value: leadMetrics?.totalLeads || 0,
        change:
          leadMetrics?.changePercent !== undefined
            ? `${leadMetrics.changePercent >= 0 ? '+' : ''}${leadMetrics.changePercent}%`
            : 'N/A',
        isPositive: (leadMetrics?.changePercent || 0) >= 0,
        icon: Users,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      },
      {
        title: 'Conversas Abertas',
        value: conversationMetrics?.open || 0,
        change: `${conversationMetrics?.total || 0} total`,
        isPositive: true,
        icon: MessageSquare,
        color: 'text-accent',
        bgColor: 'bg-accent/10',
      },
      {
        title: 'Taxa de Resolução',
        value: `${conversationMetrics?.resolutionRate || 0}%`,
        change: `${conversationMetrics?.resolved || 0} resolvidas`,
        isPositive: true,
        icon: CheckCircle2,
        color: 'text-success',
        bgColor: 'bg-success/10',
      },
      {
        title: 'Leads Quentes',
        value: leadMetrics?.leadsByTemperature.hot || 0,
        change: 'prontos para fechar',
        isPositive: true,
        icon: Zap,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
      },
    ],
    [leadMetrics, conversationMetrics]
  );

  const isLoading =
    loadingLeads || loadingFunnel || loadingAgents || loadingDaily || loadingConversations;

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb items={[{ label: 'Dashboard' }]} />

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu negócio - {PERIOD_LABELS[period]}
            {currentTenant && ` • ${currentTenant.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Tenant Filter */}
          {hasMultipleTenants && (
            <Select
              value={currentTenant?.id || 'all'}
              onValueChange={(v) => {
                if (v === 'all') {
                  setCurrentTenant(null);
                } else {
                  const tenant = tenants.find((t) => t.id === v);
                  setCurrentTenant(tenant || null);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Building2 className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Todas empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Este Trimestre</SelectItem>
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar dados</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={isExporting}>
                <Download className={cn('h-4 w-4', isExporting && 'animate-pulse')} />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportReport('leads', 'csv')}>
                Leads (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReport('funnel', 'csv')}>
                Funil (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReport('conversations', 'csv')}>
                Conversas (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReport('agents', 'csv')}>
                Atendentes (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReport('full', 'csv')}>
                Tudo (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Tempo real</span>
          </div>
        </div>
      </div>

      {/* Tenant Indicator Card */}
      {hasMultipleTenants && (
        <TenantIndicatorCard
          tenant={currentTenant}
          tenants={tenants}
          stats={tenantStats || {}}
          isLoading={loadingTenantStats}
          onSelectTenant={setCurrentTenant}
        />
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="transition-shadow hover:shadow-card-hover">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-xl',
                          stat.bgColor
                        )}
                      >
                        <stat.icon className={cn('h-6 w-6', stat.color)} />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {stat.change}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{stat.title}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
          <TabsTrigger value="agents">Atendentes</TabsTrigger>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Funnel Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Funil de Conversão
                </CardTitle>
                <CardDescription>Taxa de conversão entre etapas</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFunnel ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : funnelMetrics?.stages && funnelMetrics.stages.length > 0 ? (
                  <>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={funnelMetrics.stages}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            type="number"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis
                            type="category"
                            dataKey="stage"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            width={115}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                            {funnelMetrics.stages.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {funnelMetrics.stages.slice(1).map((stage) => (
                        <Badge key={stage.id} variant="outline" className="text-xs">
                          {stage.stage}: {stage.conversionRate}%
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    <p className="text-sm">Configure as etapas do funil</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lead Sources Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Origem dos Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <Skeleton className="h-[300px] w-full rounded-full" />
                ) : leadMetrics?.leadsBySource && leadMetrics.leadsBySource.length > 0 ? (
                  <>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={leadMetrics.leadsBySource}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {leadMetrics.leadsBySource.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {leadMetrics.leadsBySource.map((source) => (
                        <div key={source.name} className="flex items-center gap-2 text-xs">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: source.color }}
                          />
                          <span className="text-muted-foreground">
                            {source.name} ({source.value})
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    <p className="text-sm">Adicione etiquetas de origem aos leads</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Daily Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolução de Leads
                </CardTitle>
                <CardDescription>Novos leads por dia no período</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDaily ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : dailyEvolution && dailyEvolution.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={dailyEvolution}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorLeadsDash" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="leads"
                          name="Leads"
                          stroke="hsl(var(--primary))"
                          fillOpacity={1}
                          fill="url(#colorLeadsDash)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    <p className="text-sm">Sem dados para o período selecionado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Temperature Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Temperatura dos Leads
                </CardTitle>
                <CardDescription>Distribuição por nível de interesse</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <div className="space-y-6 py-4">
                    {[
                      {
                        label: 'Frios',
                        value: leadMetrics?.leadsByTemperature.cold || 0,
                        color: 'bg-temp-cold',
                        textColor: 'text-temp-cold',
                        description: 'Sem interação recente',
                      },
                      {
                        label: 'Mornos',
                        value: leadMetrics?.leadsByTemperature.warm || 0,
                        color: 'bg-temp-warm',
                        textColor: 'text-temp-warm',
                        description: 'Demonstrando interesse',
                      },
                      {
                        label: 'Quentes',
                        value: leadMetrics?.leadsByTemperature.hot || 0,
                        color: 'bg-temp-hot',
                        textColor: 'text-temp-hot',
                        description: 'Prontos para fechar',
                      },
                    ].map((temp, index) => {
                      const total = leadMetrics?.totalLeads || 1;
                      const percentage = total > 0 ? (temp.value / total) * 100 : 0;
                      return (
                        <motion.div
                          key={temp.label}
                          className="space-y-2"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">{temp.label}</span>
                              <p className="text-xs text-muted-foreground">{temp.description}</p>
                            </div>
                            <span className={cn('text-lg font-bold', temp.textColor)}>
                              {temp.value} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className={cn('h-full rounded-full', temp.color)}
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Performance da Equipe
              </CardTitle>
              <CardDescription>Métricas por atendente no período</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : agentPerformance?.agents && agentPerformance.agents.length > 0 ? (
                <div className="space-y-4">
                  {agentPerformance.agents.map((agent, index) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-center gap-4 rounded-lg bg-muted/50 p-3"
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-primary-foreground',
                          index === 0
                            ? 'bg-warning'
                            : index === 1
                              ? 'bg-muted-foreground'
                              : 'bg-muted-foreground/60'
                        )}
                      >
                        {index + 1}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={agent.avatar || undefined} />
                        <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {agent.leads} leads · {agent.resolved} resolvidos
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Timer className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{agent.avgResponseTimeFormatted}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">tempo médio</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h4 className="mb-1 font-medium text-foreground">Nenhuma atividade registrada</h4>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Não há dados de atendimento no período selecionado
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setPeriod('month')}>
                    Ver período maior
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Status das Conversas
              </CardTitle>
              <CardDescription>Distribuição por status no período</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingConversations ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="space-y-6 py-4">
                  {[
                    {
                      label: 'Abertas',
                      value: conversationMetrics?.open || 0,
                      color: 'bg-primary',
                      icon: MessageSquare,
                    },
                    {
                      label: 'Pendentes',
                      value: conversationMetrics?.pending || 0,
                      color: 'bg-warning',
                      icon: AlertCircle,
                    },
                    {
                      label: 'Resolvidas',
                      value: conversationMetrics?.resolved || 0,
                      color: 'bg-success',
                      icon: CheckCircle2,
                    },
                  ].map((status, index) => {
                    const total = conversationMetrics?.total || 1;
                    const percentage = total > 0 ? (status.value / total) * 100 : 0;
                    return (
                      <motion.div
                        key={status.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-4"
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            status.color.replace('bg-', 'bg-') + '/10'
                          )}
                        >
                          <status.icon
                            className={cn('h-5 w-5', status.color.replace('bg-', 'text-'))}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium">{status.label}</span>
                            <span className="text-sm font-bold">{status.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className={cn('h-full rounded-full', status.color)}
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Summary */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total de Conversas</span>
                      <span className="text-lg font-bold">{conversationMetrics?.total || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
