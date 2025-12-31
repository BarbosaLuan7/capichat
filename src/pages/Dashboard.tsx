import { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Target,
  Zap,
  Timer,
  Download,
  Building2,
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
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
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

// Memoized tooltip component extracted outside Dashboard to prevent recreation on every render
const CustomTooltip = memo(({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
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

// Period labels constant - never changes
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

  // Tenant stats for visual indicator
  const tenantIds = tenants.map(t => t.id);
  const { data: tenantStats, isLoading: loadingTenantStats } = useTenantStats(tenantIds);

  // Use currentTenant.id for filtering, null means "all tenants"
  const tenantId = currentTenant?.id || null;

  const { data: leadMetrics, isLoading: loadingLeads } = useLeadMetrics(period, tenantId);
  const { data: funnelMetrics, isLoading: loadingFunnel } = useFunnelMetrics(period, tenantId);
  const { data: agentPerformance, isLoading: loadingAgents } = useAgentPerformance(period, tenantId);
  const { data: dailyEvolution, isLoading: loadingDaily } = useDailyEvolution(period, tenantId);
  const { data: conversationMetrics, isLoading: loadingConversations } = useConversationMetrics(period, tenantId);

  // Memoize stats array to prevent recreation on every render
  const stats = useMemo(() => [
    {
      title: 'Total de Leads',
      value: leadMetrics?.totalLeads || 0,
      change: leadMetrics?.changePercent !== undefined 
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
  ], [leadMetrics, conversationMetrics]);

  const isLoading = loadingLeads || loadingFunnel || loadingAgents || loadingDaily || loadingConversations;

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Dashboard' }]} />
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                  const tenant = tenants.find(t => t.id === v);
                  setCurrentTenant(tenant || null);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Building2 className="w-4 h-4 mr-2" />
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
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Este Trimestre</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={isExporting}>
                <Download className={cn("w-4 h-4", isExporting && "animate-pulse")} />
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
            <Clock className="w-4 h-4" />
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="hover:shadow-card-hover transition-shadow">
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
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.bgColor)}>
                        <stat.icon className={cn('w-6 h-6', stat.color)} />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {stat.change}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid - Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Funil de Conversão
            </CardTitle>
            <CardDescription>
              Taxa de conversão entre etapas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFunnel ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={funnelMetrics?.stages || []}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      width={115}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Leads"
                      radius={[0, 4, 4, 0]}
                    >
                      {funnelMetrics?.stages?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Conversion rates */}
            {!loadingFunnel && funnelMetrics?.stages && (
              <div className="flex flex-wrap gap-2 mt-4">
                {funnelMetrics.stages.slice(1).map((stage, index) => (
                  <Badge key={stage.id} variant="outline" className="text-xs">
                    {stage.stage}: {stage.conversionRate}%
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Sources Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Origem dos Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLeads ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full rounded-full" />
              </div>
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
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {leadMetrics.leadsBySource.map((source) => (
                    <div key={source.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      <span className="text-muted-foreground">{source.name} ({source.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Adicione etiquetas de origem aos leads</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid - Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Evolução de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDaily ? (
              <Skeleton className="h-[280px] w-full" />
            ) : dailyEvolution && dailyEvolution.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyEvolution} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Sem dados de leads para o período</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temperature Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Temperatura dos Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLeads ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <div className="space-y-6 py-4">
                {[
                  { label: 'Frios', value: leadMetrics?.leadsByTemperature.cold || 0, color: 'bg-temp-cold', textColor: 'text-temp-cold' },
                  { label: 'Mornos', value: leadMetrics?.leadsByTemperature.warm || 0, color: 'bg-temp-warm', textColor: 'text-temp-warm' },
                  { label: 'Quentes', value: leadMetrics?.leadsByTemperature.hot || 0, color: 'bg-temp-hot', textColor: 'text-temp-hot' },
                ].map((temp) => {
                  const total = (leadMetrics?.totalLeads || 1);
                  const percentage = total > 0 ? (temp.value / total) * 100 : 0;
                  return (
                    <div key={temp.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{temp.label}</span>
                        <span className={cn('text-sm font-bold', temp.textColor)}>
                          {temp.value} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', temp.color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Performance da Equipe
            </CardTitle>
            <CardDescription>
              Métricas por atendente no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAgents ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : agentPerformance?.agents && agentPerformance.agents.length > 0 ? (
              <div className="space-y-4">
                {agentPerformance.agents.slice(0, 5).map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm',
                      index === 0 ? 'bg-warning' : index === 1 ? 'bg-muted-foreground' : 'bg-muted-foreground/60'
                    )}>
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={agent.avatar || undefined} />
                      <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.leads} leads · {agent.resolved} resolvidos
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Timer className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{agent.avgResponseTimeFormatted}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">tempo médio</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h4 className="font-medium text-foreground mb-1">Nenhuma atividade registrada</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Não há dados de atendimento no período selecionado
                </p>
                <Button variant="outline" size="sm" onClick={() => setPeriod('month')}>
                  Ver período maior
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Status das Conversas
            </CardTitle>
            <CardDescription>
              Distribuição por status no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingConversations ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="space-y-6 py-4">
                {[
                  { label: 'Abertas', value: conversationMetrics?.open || 0, color: 'bg-primary', icon: MessageSquare },
                  { label: 'Pendentes', value: conversationMetrics?.pending || 0, color: 'bg-warning', icon: AlertCircle },
                  { label: 'Resolvidas', value: conversationMetrics?.resolved || 0, color: 'bg-success', icon: CheckCircle2 },
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
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', status.color.replace('bg-', 'bg-') + '/10')}>
                        <status.icon className={cn('w-5 h-5', status.color.replace('bg-', 'text-'))} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{status.label}</span>
                          <span className="text-sm font-bold">{status.value}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Conversas</span>
                    <span className="text-lg font-bold">{conversationMetrics?.total || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
