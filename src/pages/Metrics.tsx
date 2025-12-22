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
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Mock data baseado no contexto do escritório previdenciário
const campanhasData = [
  { name: 'Facebook Ads', leads: 145, conversoes: 23, custo: 2500, cpl: 17.24 },
  { name: 'Google Ads', leads: 89, conversoes: 18, custo: 1800, cpl: 20.22 },
  { name: 'Instagram', leads: 67, conversoes: 12, custo: 800, cpl: 11.94 },
  { name: 'Indicação', leads: 34, conversoes: 15, custo: 0, cpl: 0 },
  { name: 'Orgânico', leads: 23, conversoes: 8, custo: 0, cpl: 0 },
];

const beneficiosData = [
  { name: 'BPC Idoso', value: 45, color: '#3B82F6' },
  { name: 'BPC Deficiente', value: 35, color: '#8B5CF6' },
  { name: 'BPC Autista', value: 28, color: '#10B981' },
  { name: 'Aposentadoria', value: 22, color: '#F59E0B' },
  { name: 'Auxílio-Doença', value: 18, color: '#EF4444' },
  { name: 'Pensão por Morte', value: 12, color: '#6366F1' },
];

const evolucaoSemanal = [
  { dia: 'Seg', leads: 45, conversoes: 8 },
  { dia: 'Ter', leads: 52, conversoes: 12 },
  { dia: 'Qua', leads: 38, conversoes: 6 },
  { dia: 'Qui', leads: 61, conversoes: 14 },
  { dia: 'Sex', leads: 55, conversoes: 11 },
  { dia: 'Sáb', leads: 28, conversoes: 5 },
  { dia: 'Dom', leads: 12, conversoes: 2 },
];

const atendentesData = [
  { nome: 'Marina (IA)', leads: 156, respondidos: 152, tempo: '2min', taxa: 97.4 },
  { nome: 'Dra. Ana Paula', leads: 89, respondidos: 85, tempo: '15min', taxa: 95.5 },
  { nome: 'João Victor', leads: 67, respondidos: 61, tempo: '8min', taxa: 91.0 },
  { nome: 'Carla Santos', leads: 45, respondidos: 42, tempo: '12min', taxa: 93.3 },
];

const funilData = [
  { etapa: 'Atendimento Inicial', quantidade: 358, valor: 0 },
  { etapa: 'Reunião Agendada', quantidade: 145, valor: 0 },
  { etapa: 'Aguardando Docs', quantidade: 89, valor: 0 },
  { etapa: 'Contrato Enviado', quantidade: 56, valor: 0 },
  { etapa: 'Assinado', quantidade: 34, valor: 170000 },
  { etapa: 'Benefício Concedido', quantidade: 23, valor: 115000 },
];

const Metrics = () => {
  const [periodo, setPeriodo] = useState('month');
  const [campanha, setCampanha] = useState('all');

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

  const totalLeads = campanhasData.reduce((acc, c) => acc + c.leads, 0);
  const totalConversoes = campanhasData.reduce((acc, c) => acc + c.conversoes, 0);
  const totalCusto = campanhasData.reduce((acc, c) => acc + c.custo, 0);
  const taxaConversao = ((totalConversoes / totalLeads) * 100).toFixed(1);
  const cplMedio = (totalCusto / totalLeads).toFixed(2);

  return (
    <div className="p-6 space-y-6">
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
          <Select value={periodo} onValueChange={setPeriodo}>
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
          <Button variant="outline" size="icon">
            <RefreshCw className="w-4 h-4" />
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
          { label: 'Total de Leads', value: totalLeads, icon: Users, color: 'text-primary', trend: '+12%', up: true },
          { label: 'Conversões', value: totalConversoes, icon: Target, color: 'text-success', trend: '+8%', up: true },
          { label: 'Taxa de Conversão', value: `${taxaConversao}%`, icon: TrendingUp, color: 'text-accent', trend: '+2.3%', up: true },
          { label: 'CPL Médio', value: `R$ ${cplMedio}`, icon: DollarSign, color: 'text-warning', trend: '-5%', up: false },
          { label: 'Investimento', value: `R$ ${totalCusto.toLocaleString()}`, icon: BarChart3, color: 'text-destructive', trend: '+15%', up: true },
        ].map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-xs',
                      kpi.up ? 'text-success border-success' : 'text-destructive border-destructive'
                    )}
                  >
                    {kpi.up ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {kpi.trend}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campanhas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campanhas">Por Campanha</TabsTrigger>
          <TabsTrigger value="beneficios">Por Benefício</TabsTrigger>
          <TabsTrigger value="atendentes">Por Atendente</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
        </TabsList>

        {/* Campanhas Tab */}
        <TabsContent value="campanhas" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leads por Campanha</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campanhasData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="conversoes" name="Conversões" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolução Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolucaoSemanal}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorLeads)" />
                      <Line type="monotone" dataKey="conversoes" name="Conversões" stroke="hsl(var(--success))" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento por Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Leads</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Conversões</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Custo</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanhasData.map((campanha) => (
                      <tr key={campanha.name} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{campanha.name}</td>
                        <td className="py-3 px-4 text-right">{campanha.leads}</td>
                        <td className="py-3 px-4 text-right text-success">{campanha.conversoes}</td>
                        <td className="py-3 px-4 text-right">
                          {((campanha.conversoes / campanha.leads) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          {campanha.custo > 0 ? `R$ ${campanha.custo.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {campanha.cpl > 0 ? `R$ ${campanha.cpl.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Benefícios Tab */}
        <TabsContent value="beneficios">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Benefício</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={beneficiosData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {beneficiosData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leads por Tipo de Benefício</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {beneficiosData.map((beneficio) => (
                    <div key={beneficio.name} className="flex items-center gap-4">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: beneficio.color }}
                      />
                      <span className="flex-1 text-sm">{beneficio.name}</span>
                      <span className="font-semibold">{beneficio.value}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${(beneficio.value / Math.max(...beneficiosData.map(b => b.value))) * 100}%`,
                            backgroundColor: beneficio.color 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Atendentes Tab */}
        <TabsContent value="atendentes">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance por Atendente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {atendentesData.map((atendente, index) => (
                  <motion.div
                    key={atendente.nome}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
                      index === 0 ? 'bg-warning' : index === 1 ? 'bg-muted-foreground' : 'bg-warning/60'
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{atendente.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {atendente.respondidos}/{atendente.leads} atendimentos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-success">{atendente.taxa}%</p>
                      <p className="text-xs text-muted-foreground">Taxa resposta</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{atendente.tempo}</p>
                      <p className="text-xs text-muted-foreground">Tempo médio</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funil Tab */}
        <TabsContent value="funil">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funilData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="etapa" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={150} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantidade" name="Quantidade" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Metrics;