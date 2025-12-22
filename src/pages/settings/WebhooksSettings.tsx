import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Webhook, 
  MoreVertical, 
  Trash2, 
  Edit, 
  Play, 
  Pause, 
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Eye
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

const WEBHOOK_EVENTS = [
  { value: 'lead.created', label: 'Lead criado', category: 'Lead' },
  { value: 'lead.updated', label: 'Lead atualizado', category: 'Lead' },
  { value: 'lead.deleted', label: 'Lead excluído', category: 'Lead' },
  { value: 'lead.stage_changed', label: 'Lead mudou de etapa', category: 'Lead' },
  { value: 'lead.assigned', label: 'Lead atribuído', category: 'Lead' },
  { value: 'lead.temperature_changed', label: 'Temperatura alterada', category: 'Lead' },
  { value: 'lead.label_added', label: 'Etiqueta adicionada', category: 'Lead' },
  { value: 'lead.label_removed', label: 'Etiqueta removida', category: 'Lead' },
  { value: 'message.received', label: 'Mensagem recebida', category: 'Mensagem' },
  { value: 'message.sent', label: 'Mensagem enviada', category: 'Mensagem' },
  { value: 'conversation.created', label: 'Conversa criada', category: 'Conversa' },
  { value: 'conversation.assigned', label: 'Conversa atribuída', category: 'Conversa' },
  { value: 'conversation.resolved', label: 'Conversa resolvida', category: 'Conversa' },
  { value: 'task.created', label: 'Tarefa criada', category: 'Tarefa' },
  { value: 'task.completed', label: 'Tarefa concluída', category: 'Tarefa' },
] as const;

type WebhookEvent = typeof WEBHOOK_EVENTS[number]['value'];

interface WebhookFormData {
  name: string;
  url: string;
  events: WebhookEvent[];
  headers: Record<string, string>;
  is_active: boolean;
}

const WebhooksSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
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
              id: 'test-id',
              name: 'Lead de Teste',
              phone: '+5511999999999',
              email: 'teste@exemplo.com',
              temperature: 'warm',
              created_at: new Date().toISOString(),
            },
            _test: true,
          },
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Webhook de teste enviado', description: 'Verifique os logs para confirmar' });
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
    // Parse headers from text
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'retrying':
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
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
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Webhook
        </Button>
      </div>

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
                Selecione os eventos que dispararão este webhook
              </p>
              {Object.entries(groupedEvents).map(([category, events]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-sm">{category}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {events.map((event) => (
                      <div key={event.value} className="flex items-center gap-2">
                        <Checkbox
                          id={event.value}
                          checked={formData.events.includes(event.value)}
                          onCheckedChange={() => handleEventToggle(event.value)}
                        />
                        <Label htmlFor={event.value} className="text-sm cursor-pointer">
                          {event.label}
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
    </div>
  );
};

export default WebhooksSettings;
