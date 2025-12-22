import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  Timer,
  MessageSquare,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
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
  LineChart,
  Line,
  Legend,
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
import { useLabels } from '@/hooks/useLabels';

const Metrics = () => {
  const [periodo, setPeriodo] = useState<PeriodFilter>('month');

  const { data: leadMetrics, isLoading: loadingLeads, refetch: refetchLeads } = useLeadMetrics(periodo);
  const { data: funnelMetrics, isLoading: loadingFunnel, refetch: refetchFunnel } = useFunnelMetrics(periodo);
  const { data: agentPerformance, isLoading: loadingAgents, refetch: refetchAgents } = useAgentPerformance(periodo);
  const { data: dailyEvolution, isLoading: loadingDaily, refetch: refetchDaily } = useDailyEvolution(periodo);
  const { data: conversationMetrics, isLoading: loadingConversations, refetch: refetchConversations } = useConversationMetrics(periodo);
  const { data: labels } = useLabels();

  const benefitLabels = labels?.filter(l => l.category === 'beneficio') || [];

  const handleRefresh = () => {
    refetchLeads();
    refetchFunnel();
    refetchAgents();
    refetchDaily();
    refetchConversations();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
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
  };

  const isLoading = loadingLeads || loadingFunnel || loadingAgents || loadingDaily || loadingConversations;

  // Calculate conversion rate
  const conversionRate = funnelMetrics?.stages && funnelMetrics.stages.length > 1
    ? ((funnelMetrics.stages[funnelMetrics.stages.length - 1].count / (funnelMetrics.stages[0].count || 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Métricas' }]} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Métricas e Relatórios
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho das suas campanhas e equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodFilter)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { 
            label: 'Total de Leads', 
            value: leadMetrics?.totalLeads || 0, 
            icon: Users, 
            color: 'text-primary', 
            loading: loadingLeads 
          },
          { 
            label: 'Conversas', 
            value: conversationMetrics?.total || 0, 
            icon: MessageSquare, 
            color: 'text-accent', 
            loading: loadingConversations 
          },
          { 
            label: 'Taxa Conversão', 
            value: `${conversionRate}%`, 
            icon: Target, 
            color: 'text-success', 
            loading: loadingFunnel 
          },
          { 
            label: 'Taxa Resolução', 
            value: `${conversationMetrics?.resolutionRate || 0}%`, 
            icon: CheckCircle2, 
            color: 'text-warning', 
            loading: loadingConversations 
          },
          { 
            label: 'Leads Quentes', 
            value: leadMetrics?.leadsByTemperature.hot || 0, 
            icon: Zap, 
            color: 'text-destructive', 
            loading: loadingLeads 
          },
        ].map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                {kpi.loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="funil" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funil">Funil de Conversão</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="atendentes">Por Atendente</TabsTrigger>
          <TabsTrigger value="origens">Por Origem</TabsTrigger>
        </TabsList>

        {/* Funil Tab */}
        <TabsContent value="funil" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Funil de Conversão</CardTitle>
                <CardDescription>
                  Quantidade de leads em cada etapa do funil
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFunnel ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : funnelMetrics?.stages && funnelMetrics.stages.length > 0 ? (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={funnelMetrics.stages}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis 
                          dataKey="stage" 
                          type="category" 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          width={115} 
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                          {funnelMetrics.stages.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    <p>Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Taxas de Conversão</CardTitle>
                <CardDescription>
                  % de leads em relação ao topo do funil
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFunnel ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : funnelMetrics?.stages && funnelMetrics.stages.length > 0 ? (
                  <div className="space-y-4">
                    {funnelMetrics.stages.map((stage, index) => (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{stage.stage}</p>
                          <p className="text-xs text-muted-foreground">{stage.count} leads</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {stage.conversionRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Configure as etapas do funil</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolução Tab */}
        <TabsContent value="evolucao" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolução de Leads</CardTitle>
                <CardDescription>
                  Novos leads por dia no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDaily ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : dailyEvolution && dailyEvolution.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyEvolution}>
                        <defs>
                          <linearGradient id="colorLeadsMetrics" x1="0" y1="0" x2="0" y2="1">
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
                          fill="url(#colorLeadsMetrics)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <p>Sem dados para o período selecionado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Temperatura dos Leads</CardTitle>
                <CardDescription>
                  Distribuição por nível de interesse
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <div className="space-y-6 py-4">
                    {[
                      { label: 'Frios', value: leadMetrics?.leadsByTemperature.cold || 0, color: 'bg-blue-500', description: 'Sem interação recente' },
                      { label: 'Mornos', value: leadMetrics?.leadsByTemperature.warm || 0, color: 'bg-yellow-500', description: 'Demonstrando interesse' },
                      { label: 'Quentes', value: leadMetrics?.leadsByTemperature.hot || 0, color: 'bg-red-500', description: 'Prontos para fechar' },
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
                            <span className="text-lg font-bold">{temp.value}</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
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

        {/* Atendentes Tab */}
        <TabsContent value="atendentes">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance por Atendente</CardTitle>
              <CardDescription>
                Métricas detalhadas de cada membro da equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : agentPerformance?.agents && agentPerformance.agents.length > 0 ? (
                <div className="space-y-4">
                  {agentPerformance.agents.map((atendente, index) => (
                    <motion.div
                      key={atendente.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
                        index === 0 ? 'bg-warning' : index === 1 ? 'bg-muted-foreground' : 'bg-muted-foreground/60'
                      )}>
                        {index + 1}
                      </div>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={atendente.avatar || undefined} />
                        <AvatarFallback className="text-lg">{atendente.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-lg">{atendente.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {atendente.leads} leads · {atendente.conversations} conversas · {atendente.resolved} resolvidas
                        </p>
                      </div>
                      <div className="text-center px-4 border-l border-border">
                        <p className="font-bold text-lg text-success">{atendente.responseRate}%</p>
                        <p className="text-xs text-muted-foreground">Taxa resposta</p>
                      </div>
                      <div className="text-center px-4 border-l border-border">
                        <div className="flex items-center gap-1 justify-center">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <p className="font-bold text-lg">{atendente.avgResponseTimeFormatted}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Tempo médio</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Nenhum atendente com atividade</p>
                  <p className="text-sm">Atribua leads aos membros da equipe para ver as métricas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Origens Tab */}
        <TabsContent value="origens">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leads por Origem</CardTitle>
                <CardDescription>
                  Distribuição de leads por canal de aquisição
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : leadMetrics?.leadsBySource && leadMetrics.leadsBySource.length > 0 ? (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadMetrics.leadsBySource}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {leadMetrics.leadsBySource.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Adicione etiquetas de origem aos leads</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhamento por Origem</CardTitle>
                <CardDescription>
                  Quantidade de leads por cada fonte
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : leadMetrics?.leadsBySource && leadMetrics.leadsBySource.length > 0 ? (
                  <div className="space-y-4">
                    {leadMetrics.leadsBySource.map((source, index) => {
                      const total = leadMetrics.totalLeads || 1;
                      const percentage = (source.value / total) * 100;
                      return (
                        <motion.div 
                          key={source.name} 
                          className="flex items-center gap-4"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div 
                            className="w-4 h-4 rounded-full shrink-0" 
                            style={{ backgroundColor: source.color }}
                          />
                          <span className="flex-1 text-sm font-medium">{source.name}</span>
                          <span className="font-bold">{source.value}</span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full rounded-full" 
                              style={{ backgroundColor: source.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Nenhuma origem identificada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Metrics;
