import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Play, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Zap,
  Users,
  MessageSquare,
  Clock,
  TrendingUp
} from 'lucide-react';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';

interface StressTestMetrics {
  total_messages: number;
  successful: number;
  failed: number;
  avg_response_ms: number;
  min_response_ms: number;
  max_response_ms: number;
  leads_created: number;
  conversations_created: number;
  duration_ms: number;
  errors: string[];
}

interface StressTestResult {
  success: boolean;
  config: {
    total_leads: number;
    messages_per_lead: number;
    batch_size: number;
    delay_between_batches_ms: number;
    dry_run: boolean;
  };
  metrics: StressTestMetrics;
  summary: {
    success_rate: string;
    messages_per_second: string;
    avg_response: string;
  };
}

interface CleanupResult {
  success: boolean;
  message: string;
  deleted: {
    leads: number;
    conversations: number;
    messages: number;
  };
}

export default function StressTestSettings() {
  const { isAdmin } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  
  // Config state
  const [totalLeads, setTotalLeads] = useState(200);
  const [messagesPerLead, setMessagesPerLead] = useState(5);
  const [batchSize, setBatchSize] = useState(10);
  const [delayMs, setDelayMs] = useState(100);
  const [dryRun, setDryRun] = useState(true);

  const totalMessages = totalLeads * messagesPerLead;

  const runStressTest = async () => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem executar testes');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada');
        return;
      }

      const response = await supabase.functions.invoke('stress-test', {
        body: {
          total_leads: totalLeads,
          messages_per_lead: messagesPerLead,
          batch_size: batchSize,
          delay_between_batches_ms: delayMs,
          dry_run: dryRun,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResult(response.data as StressTestResult);
      
      if (response.data.success) {
        toast.success(dryRun ? 'Simulação concluída!' : 'Teste de estresse concluído!');
      }
    } catch (error) {
      console.error('Erro no teste:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const cleanupTestData = async () => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem limpar dados');
      return;
    }

    setIsCleaning(true);
    setCleanupResult(null);

    try {
      const response = await supabase.functions.invoke('cleanup-test-data', {
        body: {},
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setCleanupResult(response.data as CleanupResult);
      toast.success('Dados de teste limpos!');
    } catch (error) {
      console.error('Erro na limpeza:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsCleaning(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acesso negado</AlertTitle>
          <AlertDescription>
            Apenas administradores podem acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageBreadcrumb 
        items={[
          { label: 'Configurações', href: '/settings' },
          { label: 'Teste de Estresse' }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teste de Estresse</h1>
          <p className="text-muted-foreground">
            Simule alta carga de mensagens para testar a performance do sistema
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Configuração do Teste
            </CardTitle>
            <CardDescription>
              Defina os parâmetros do teste de carga
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalLeads">Total de Leads</Label>
                <Input
                  id="totalLeads"
                  type="number"
                  min={1}
                  max={500}
                  value={totalLeads}
                  onChange={(e) => setTotalLeads(Number(e.target.value))}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground">Máx: 500</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="messagesPerLead">Msgs por Lead</Label>
                <Input
                  id="messagesPerLead"
                  type="number"
                  min={1}
                  max={20}
                  value={messagesPerLead}
                  onChange={(e) => setMessagesPerLead(Number(e.target.value))}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground">Máx: 20</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchSize">Tamanho do Batch</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min={1}
                  max={50}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground">Msgs simultâneas</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delayMs">Delay (ms)</Label>
                <Input
                  id="delayMs"
                  type="number"
                  min={50}
                  max={5000}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground">Entre batches</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dryRun">Simulação (Dry Run)</Label>
                <p className="text-xs text-muted-foreground">
                  Não envia mensagens reais
                </p>
              </div>
              <Switch
                id="dryRun"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isRunning}
              />
            </div>

            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertTitle>Total de mensagens</AlertTitle>
              <AlertDescription>
                {totalLeads} leads × {messagesPerLead} mensagens = <strong>{totalMessages.toLocaleString()}</strong> mensagens
              </AlertDescription>
            </Alert>

            {!dryRun && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção!</AlertTitle>
                <AlertDescription>
                  Modo real ativado. Isso criará leads e mensagens reais no banco de dados.
                  Use a função de limpeza após o teste.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={runStressTest} 
              disabled={isRunning}
              className="w-full"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executando teste...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {dryRun ? 'Simular Teste' : 'Iniciar Teste Real'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resultados
            </CardTitle>
            <CardDescription>
              Métricas de performance do último teste
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRunning && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
                <p className="text-center text-muted-foreground">
                  Executando teste de estresse...
                </p>
                <Progress value={undefined} className="animate-pulse" />
              </div>
            )}

            {!isRunning && !result && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mb-2 opacity-50" />
                <p>Execute um teste para ver os resultados</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Sucesso
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Falha
                    </Badge>
                  )}
                  {result.config.dry_run && (
                    <Badge variant="outline">Simulação</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold text-green-500">
                      {result.summary.success_rate}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Msgs/segundo</p>
                    <p className="text-2xl font-bold">
                      {result.summary.messages_per_second}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tempo Médio</p>
                    <p className="text-2xl font-bold">
                      {result.summary.avg_response}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Duração Total</p>
                    <p className="text-2xl font-bold">
                      {(result.metrics.duration_ms / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{result.metrics.leads_created} leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{result.metrics.successful} msgs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{result.metrics.min_response_ms}-{result.metrics.max_response_ms}ms</span>
                  </div>
                </div>

                {result.metrics.failed > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>{result.metrics.failed} falhas</AlertTitle>
                    <AlertDescription>
                      {result.metrics.errors.slice(0, 3).map((e, i) => (
                        <p key={i} className="text-xs truncate">{e}</p>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Limpeza */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Limpeza de Dados de Teste
          </CardTitle>
          <CardDescription>
            Remove todos os leads e mensagens criados durante os testes
            (telefones começando com 5511999000 ou nomes contendo [TESTE])
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cleanupResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Limpeza concluída</AlertTitle>
              <AlertDescription>
                Removidos: {cleanupResult.deleted.leads} leads, {' '}
                {cleanupResult.deleted.conversations} conversas, {' '}
                {cleanupResult.deleted.messages} mensagens
              </AlertDescription>
            </Alert>
          )}

          <Button 
            variant="destructive" 
            onClick={cleanupTestData}
            disabled={isCleaning}
          >
            {isCleaning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar Dados de Teste
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
