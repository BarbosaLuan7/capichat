import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Webhook, 
  MoreVertical, 
  Trash2, 
  Edit, 
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Copy,
  Book,
  Code,
  FileJson
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const WEBHOOK_EVENTS = [
  { value: 'lead.created', label: 'Lead criado', labelPt: 'lead.criado', category: 'Lead' },
  { value: 'lead.updated', label: 'Lead atualizado', labelPt: 'lead.atualizado', category: 'Lead' },
  { value: 'lead.deleted', label: 'Lead excluído', labelPt: 'lead.excluido', category: 'Lead' },
  { value: 'lead.stage_changed', label: 'Lead mudou de etapa', labelPt: 'lead.etapa_alterada', category: 'Lead' },
  { value: 'lead.assigned', label: 'Lead atribuído', labelPt: 'lead.atribuido', category: 'Lead' },
  { value: 'lead.temperature_changed', label: 'Temperatura alterada', labelPt: 'lead.temperatura_alterada', category: 'Lead' },
  { value: 'lead.label_added', label: 'Etiqueta adicionada', labelPt: 'lead.etiqueta_adicionada', category: 'Lead' },
  { value: 'lead.label_removed', label: 'Etiqueta removida', labelPt: 'lead.etiqueta_removida', category: 'Lead' },
  { value: 'lead.summary_updated', label: 'Resumo do caso atualizado', labelPt: 'lead.resumo_atualizado', category: 'Lead' },
  { value: 'message.received', label: 'Mensagem recebida', labelPt: 'mensagem.recebida', category: 'Mensagem' },
  { value: 'message.sent', label: 'Mensagem enviada', labelPt: 'mensagem.enviada', category: 'Mensagem' },
  { value: 'conversation.created', label: 'Conversa criada', labelPt: 'conversa.criada', category: 'Conversa' },
  { value: 'conversation.assigned', label: 'Conversa atribuída', labelPt: 'conversa.atribuida', category: 'Conversa' },
  { value: 'conversation.resolved', label: 'Conversa resolvida', labelPt: 'conversa.resolvida', category: 'Conversa' },
  { value: 'task.created', label: 'Tarefa criada', labelPt: 'tarefa.criada', category: 'Tarefa' },
  { value: 'task.completed', label: 'Tarefa concluída', labelPt: 'tarefa.concluida', category: 'Tarefa' },
] as const;

type WebhookEvent = typeof WEBHOOK_EVENTS[number]['value'];

interface WebhookFormData {
  name: string;
  url: string;
  events: WebhookEvent[];
  headers: Record<string, string>;
  is_active: boolean;
}

// Payload de teste realista em PT-BR
const TEST_PAYLOAD = {
  evento: 'lead.criado',
  evento_original: 'lead.created',
  versao_api: '1.0',
  ambiente: 'teste',
  data_hora: new Date().toISOString().slice(0, 19) + '-03:00',
  id_entrega: 'teste-' + Math.random().toString(36).substring(7),
  dados: {
    lead: {
      id: 'teste-001',
      nome: 'Maria Aparecida dos Santos',
      telefone: '+5511999998888',
      email: 'maria.santos@email.com',
      cpf: '123.456.789-00',
      data_nascimento: '1958-05-15',
      tipo_beneficio: 'BPC Idoso',
      origem: 'Facebook Ads - BPC Idoso',
      utm_medium: 'cpc',
      temperatura: 'morno',
      status: 'ativo',
      etapa_id: 'uuid-etapa-novo-lead',
      criado_em: new Date().toISOString().slice(0, 19) + '-03:00',
      atualizado_em: new Date().toISOString().slice(0, 19) + '-03:00',
    },
    _teste: true,
    _descricao: 'Este é um payload de teste enviado manualmente',
  },
  metadados: {
    webhook_id: 'uuid-webhook',
    tentativa: 1,
    max_tentativas: 3,
    fuso_horario: 'America/Sao_Paulo',
    formato_data: 'ISO 8601 com offset GMT-3',
  },
};

// Exemplos de payload para documentação
const PAYLOAD_EXAMPLES = {
  'lead.created': {
    evento: 'lead.criado',
    evento_original: 'lead.created',
    versao_api: '1.0',
    ambiente: 'producao',
    data_hora: '2024-12-22T18:30:00-03:00',
    id_entrega: 'abc123-def456',
    dados: {
      lead: {
        id: 'uuid',
        nome: 'Maria da Silva Santos',
        telefone: '+5511999991234',
        email: 'maria@email.com',
        cpf: '123.456.789-00',
        tipo_beneficio: 'BPC Idoso',
        origem: 'Facebook Ads - BPC Idoso',
        temperatura: 'morno',
        status: 'ativo',
        criado_em: '2024-12-22T18:30:00-03:00',
      },
    },
    metadados: {
      webhook_id: 'uuid',
      tentativa: 1,
      max_tentativas: 3,
      fuso_horario: 'America/Sao_Paulo',
    },
  },
  'lead.stage_changed': {
    evento: 'lead.etapa_alterada',
    evento_original: 'lead.stage_changed',
    versao_api: '1.0',
    ambiente: 'producao',
    data_hora: '2024-12-22T18:30:00-03:00',
    id_entrega: 'abc123-def456',
    dados: {
      lead: {
        id: 'uuid',
        nome: 'Maria da Silva Santos',
        telefone: '+5511999991234',
      },
      etapa_anterior_id: 'uuid-etapa-anterior',
      etapa_atual_id: 'uuid-etapa-atual',
    },
    metadados: {
      webhook_id: 'uuid',
      tentativa: 1,
      max_tentativas: 3,
    },
  },
  'message.received': {
    evento: 'mensagem.recebida',
    evento_original: 'message.received',
    versao_api: '1.0',
    ambiente: 'producao',
    data_hora: '2024-12-22T18:30:00-03:00',
    id_entrega: 'abc123-def456',
    dados: {
      mensagem: {
        id: 'uuid',
        tipo: 'texto',
        conteudo: 'Bom dia, gostaria de saber sobre o BPC',
        tipo_remetente: 'lead',
        direcao: 'entrada',
        criado_em: '2024-12-22T18:29:55-03:00',
      },
    },
    metadados: {
      webhook_id: 'uuid',
      tentativa: 1,
      max_tentativas: 3,
    },
  },
};

const HMAC_VALIDATION_CODE = `// Exemplo de validação HMAC-SHA256 em JavaScript/Node.js
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Uso no seu servidor (Express.js)
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-assinatura'];
  const secret = 'seu_secret_aqui';
  
  if (!validateWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ erro: 'Assinatura inválida' });
  }
  
  // Processar webhook...
  const evento = req.body.evento;
  const dados = req.body.dados;
  
  console.log('Evento recebido:', evento);
  res.json({ recebido: true });
});`;

const WebhooksSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>({
    name: '',
    url: '',
    events: [],
    headers: {},
    is_active: true,
  });
  const [headersText, setHeadersText] = useState('');

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch logs for selected webhook
  const { data: webhookLogs } = useQuery({
    queryKey: ['webhook-logs', selectedWebhook],
    queryFn: async () => {
      if (!selectedWebhook) return [];
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', selectedWebhook)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWebhook,
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: WebhookFormData) => {
      const { error } = await supabase.from('webhooks').insert({
        name: data.name,
        url: data.url,
        events: data.events,
        headers: data.headers,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsModalOpen(false);
      resetForm();
      toast({ title: 'Webhook criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar webhook', description: error.message, variant: 'destructive' });
    },
  });

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WebhookFormData> }) => {
      const { error } = await supabase
        .from('webhooks')
        .update({
          name: data.name,
          url: data.url,
          events: data.events,
          headers: data.headers,
          is_active: data.is_active,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsModalOpen(false);
      setEditingWebhook(null);
      resetForm();
      toast({ title: 'Webhook atualizado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar webhook', description: error.message, variant: 'destructive' });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: 'Webhook excluído com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir webhook', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('webhooks')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const webhook = webhooks?.find(w => w.id === webhookId);
      if (!webhook) throw new Error('Webhook não encontrado');

      const response = await supabase.functions.invoke('dispatch-webhook', {
        body: {
          event: 'lead.created',
          data: {
            lead: {
              id: 'teste-' + Math.random().toString(36).substring(7),
              name: 'Maria Aparecida dos Santos',
              phone: '+5511999998888',
              email: 'maria.santos@email.com',
              cpf: '123.456.789-00',
              birth_date: '1958-05-15',
              benefit_type: 'BPC Idoso',
              source: 'Facebook Ads - BPC Idoso',
              utm_medium: 'cpc',
              temperature: 'warm',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            _test: true,
          },
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast({ 
        title: 'Webhook de teste enviado', 
        description: 'Payload em PT-BR com fuso GMT-3 enviado. Verifique os logs.' 
      });
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao testar webhook', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', url: '', events: [], headers: {}, is_active: true });
    setHeadersText('');
    setEditingWebhook(null);
  };

  const handleEdit = (webhook: typeof webhooks[0]) => {
    setEditingWebhook(webhook.id);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events as WebhookEvent[],
      headers: (webhook.headers as Record<string, string>) || {},
      is_active: webhook.is_active,
    });
    setHeadersText(
      Object.entries((webhook.headers as Record<string, string>) || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    );
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    const headers: Record<string, string> = {};
    headersText.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join(':').trim();
      }
    });

    const data = { ...formData, headers };

    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEventToggle = (event: WebhookEvent) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'retrying':
        return <RefreshCw className="w-4 h-4 text-warning" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const groupedEvents = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) acc[event.category] = [];
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, typeof WEBHOOK_EVENTS[number][]>);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageBreadcrumb items={[
        { label: 'Configurações', href: '/settings' },
        { label: 'Webhooks' }
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground">Configure webhooks para integrar com sistemas externos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsDocsModalOpen(true)}>
            <Book className="w-4 h-4 mr-2" />
            Documentação
          </Button>
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Webhook
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileJson className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Payloads em PT-BR com fuso GMT-3</p>
              <p className="text-muted-foreground">
                Os webhooks são enviados com campos em português e datas no fuso horário de São Paulo (GMT-3).
                Clique em "Documentação" para ver exemplos de payload e código de validação HMAC.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando...
            </CardContent>
          </Card>
        ) : webhooks?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Webhook className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum webhook configurado</h3>
              <p className="text-muted-foreground mb-4">
                Webhooks permitem enviar dados para sistemas externos quando eventos ocorrem
              </p>
              <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro webhook
              </Button>
            </CardContent>
          </Card>
        ) : (
          webhooks?.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Webhook className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{webhook.name}</h3>
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                        {webhook.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{webhook.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.slice(0, 3).map((event: string) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {WEBHOOK_EVENTS.find(e => e.value === event)?.label || event}
                        </Badge>
                      ))}
                      {webhook.events.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{webhook.events.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: webhook.id, is_active: checked })
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedWebhook(webhook.id);
                        setIsLogsModalOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate(webhook.id)}
                      disabled={testMutation.isPending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(webhook)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteMutation.mutate(webhook.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Webhook Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure o webhook para receber notificações de eventos
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">Configuração</TabsTrigger>
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Integração n8n"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>URL de destino</Label>
                <Input
                  placeholder="https://seu-servidor.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Webhook ativo</Label>
              </div>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione os eventos que dispararão este webhook. Os eventos serão enviados com nomes em PT-BR.
              </p>
              {Object.entries(groupedEvents).map(([category, events]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-sm">{category}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {events.map((event) => (
                      <div key={event.value} className="flex items-center gap-2">
                        <Checkbox
                          id={event.value}
                          checked={formData.events.includes(event.value)}
                          onCheckedChange={() => handleEventToggle(event.value)}
                        />
                        <Label htmlFor={event.value} className="text-sm cursor-pointer flex-1">
                          <span>{event.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            → {event.labelPt}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div className="space-y-2">
                <Label>Headers customizados</Label>
                <Textarea
                  placeholder="Authorization: Bearer token&#10;X-Custom-Header: value"
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Um header por linha no formato: Nome: Valor
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-2">Headers padrão enviados automaticamente:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <code>X-Webhook-Evento</code> - Nome do evento em PT-BR</li>
                  <li>• <code>X-Webhook-Versao</code> - Versão da API (1.0)</li>
                  <li>• <code>X-Webhook-Ambiente</code> - producao ou teste</li>
                  <li>• <code>X-Webhook-Timestamp</code> - Unix timestamp</li>
                  <li>• <code>X-Webhook-Assinatura</code> - HMAC-SHA256</li>
                  <li>• <code>X-Webhook-ID-Entrega</code> - ID único da entrega</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.url || formData.events.length === 0}
            >
              {editingWebhook ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Modal */}
      <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Logs do Webhook</DialogTitle>
            <DialogDescription>
              Histórico de disparos e respostas
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {webhookLogs?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum log encontrado
                </p>
              ) : (
                webhookLogs?.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(log.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.event}</Badge>
                            {log.response_status && (
                              <Badge variant={log.response_status >= 200 && log.response_status < 300 ? 'default' : 'destructive'}>
                                {log.response_status}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Tentativa {log.attempts}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                          )}
                          {log.response_body && (
                            <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                              {log.response_body.substring(0, 200)}
                              {log.response_body.length > 200 && '...'}
                            </pre>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Documentation Modal */}
      <Dialog open={isDocsModalOpen} onOpenChange={setIsDocsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documentação de Webhooks</DialogTitle>
            <DialogDescription>
              Exemplos de payload, headers e validação de assinatura HMAC
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="payload" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="payload">Payload</TabsTrigger>
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="hmac">Validação HMAC</TabsTrigger>
            </TabsList>

            <TabsContent value="payload" className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Estrutura do Payload</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(TEST_PAYLOAD, null, 2), 'Payload')}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                </div>
                <pre className="text-xs bg-background p-4 rounded overflow-x-auto">
                  {JSON.stringify(TEST_PAYLOAD, null, 2)}
                </pre>
              </div>

              <div className="grid gap-2">
                <h4 className="font-medium">Campos principais:</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li><code className="bg-muted px-1 py-0.5 rounded">evento</code> - Nome do evento em PT-BR (ex: lead.criado)</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">evento_original</code> - Nome técnico do evento (ex: lead.created)</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">versao_api</code> - Versão da API do webhook</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">ambiente</code> - "producao" ou "teste"</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">data_hora</code> - Data/hora em GMT-3 (São Paulo)</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">id_entrega</code> - ID único desta entrega</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">dados</code> - Dados do evento (lead, mensagem, etc)</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">metadados</code> - Informações sobre tentativas e webhook</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Formato de Data/Hora</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Todas as datas são enviadas no formato ISO 8601 com offset GMT-3 (horário de Brasília):
                </p>
                <code className="bg-muted px-2 py-1 rounded text-sm">2024-12-22T18:30:00-03:00</code>
              </div>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Evento Técnico</th>
                      <th className="text-left py-2 px-4">Evento PT-BR</th>
                      <th className="text-left py-2 px-4">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEBHOOK_EVENTS.map((event) => (
                      <tr key={event.value} className="border-b">
                        <td className="py-2 px-4"><code className="text-xs">{event.value}</code></td>
                        <td className="py-2 px-4"><code className="text-xs">{event.labelPt}</code></td>
                        <td className="py-2 px-4 text-muted-foreground">{event.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="lead-created">
                  <AccordionTrigger>Exemplo: lead.criado</AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                      {JSON.stringify(PAYLOAD_EXAMPLES['lead.created'], null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="lead-stage">
                  <AccordionTrigger>Exemplo: lead.etapa_alterada</AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                      {JSON.stringify(PAYLOAD_EXAMPLES['lead.stage_changed'], null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="message-received">
                  <AccordionTrigger>Exemplo: mensagem.recebida</AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                      {JSON.stringify(PAYLOAD_EXAMPLES['message.received'], null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Header</th>
                      <th className="text-left py-2 px-4">Exemplo</th>
                      <th className="text-left py-2 px-4">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">Content-Type</code></td>
                      <td className="py-2 px-4"><code className="text-xs">application/json; charset=utf-8</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Tipo de conteúdo</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-Evento</code></td>
                      <td className="py-2 px-4"><code className="text-xs">lead.criado</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Nome do evento em PT-BR</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-Evento-Original</code></td>
                      <td className="py-2 px-4"><code className="text-xs">lead.created</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Nome técnico do evento</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-Versao</code></td>
                      <td className="py-2 px-4"><code className="text-xs">1.0</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Versão da API</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-Ambiente</code></td>
                      <td className="py-2 px-4"><code className="text-xs">producao</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Ambiente (producao/teste)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-Timestamp</code></td>
                      <td className="py-2 px-4"><code className="text-xs">1734901800</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Unix timestamp</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-Assinatura</code></td>
                      <td className="py-2 px-4"><code className="text-xs">sha256=abc123...</code></td>
                      <td className="py-2 px-4 text-muted-foreground">Assinatura HMAC-SHA256</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4"><code className="text-xs">X-Webhook-ID-Entrega</code></td>
                      <td className="py-2 px-4"><code className="text-xs">uuid-unico</code></td>
                      <td className="py-2 px-4 text-muted-foreground">ID único desta entrega</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="hmac" className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Código de Validação (Node.js)</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(HMAC_VALIDATION_CODE, 'Código')}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                </div>
                <pre className="text-xs bg-background p-4 rounded overflow-x-auto whitespace-pre-wrap">
                  {HMAC_VALIDATION_CODE}
                </pre>
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium">Como funciona a validação:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Pegue o corpo da requisição (JSON stringificado)</li>
                  <li>Gere um HMAC-SHA256 usando o secret do webhook</li>
                  <li>Compare com o header <code className="bg-muted px-1 py-0.5 rounded">X-Webhook-Assinatura</code></li>
                  <li>Se forem iguais, o webhook é autêntico</li>
                </ol>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <h4 className="font-medium text-yellow-700 dark:text-yellow-400 mb-2">⚠️ Importante</h4>
                <p className="text-sm text-muted-foreground">
                  Sempre valide a assinatura HMAC antes de processar o webhook. 
                  Isso garante que a requisição veio do sistema GaranteDireito e não foi adulterada.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebhooksSettings;
