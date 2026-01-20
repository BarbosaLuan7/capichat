import { useState } from 'react';
import { z } from 'zod';
import {
  Plus,
  Smartphone,
  MoreVertical,
  Trash2,
  Edit,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Info,
  Zap,
  MessageCircle,
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
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { toast } from 'sonner';
import {
  useWhatsAppConfigs,
  useCreateWhatsAppConfig,
  useUpdateWhatsAppConfig,
  useDeleteWhatsAppConfig,
  useTestWhatsAppConnection,
  useTestWhatsAppMessage,
  WhatsAppConfig,
  WhatsAppConfigInsert,
} from '@/hooks/useWhatsAppConfig';

const PROVIDERS = [
  {
    value: 'waha',
    label: 'WAHA (WhatsApp HTTP API)',
    description: 'Open source, self-hosted',
    docs: 'https://waha.devlike.pro/docs/',
  },
  {
    value: 'evolution',
    label: 'Evolution API',
    description: 'Open source, multi-device',
    docs: 'https://doc.evolution-api.com/',
  },
  {
    value: 'z-api',
    label: 'Z-API',
    description: 'Serviço brasileiro pago',
    docs: 'https://developer.z-api.io/',
  },
  {
    value: 'custom',
    label: 'Gateway Customizado',
    description: 'Endpoint HTTP personalizado',
    docs: null,
  },
] as const;

// Zod schema para validação do formulário
const whatsAppConfigSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  provider: z.enum(['waha', 'evolution', 'z-api', 'custom']),
  base_url: z.string().url('URL inválida').min(1, 'URL é obrigatória'),
  api_key: z.string().min(1, 'API Key é obrigatória'),
  instance_name: z.string().optional(),
  phone_number: z.string().optional(),
  is_active: z.boolean(),
});

// Schema para edição (api_key opcional)
const whatsAppConfigEditSchema = whatsAppConfigSchema.extend({
  api_key: z.string().optional(),
});

const WhatsAppSettings = () => {
  const { data: configs, isLoading } = useWhatsAppConfigs();
  const createMutation = useCreateWhatsAppConfig();
  const updateMutation = useUpdateWhatsAppConfig();
  const deleteMutation = useDeleteWhatsAppConfig();
  const testMutation = useTestWhatsAppConnection();
  const testMessageMutation = useTestWhatsAppMessage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WhatsAppConfig | null>(null);
  const [formData, setFormData] = useState<WhatsAppConfigInsert>({
    name: '',
    provider: 'waha',
    base_url: '',
    api_key: '',
    instance_name: '',
    phone_number: '',
    is_active: true,
  });

  // Test message modal state
  const [testMessageModal, setTestMessageModal] = useState<{
    open: boolean;
    instanceId: string;
    instanceName: string;
  }>({
    open: false,
    instanceId: '',
    instanceName: '',
  });
  const [testPhone, setTestPhone] = useState('');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/api-messages-receive`;

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'waha',
      base_url: '',
      api_key: '',
      instance_name: '',
      phone_number: '',
      is_active: true,
    });
    setEditingConfig(null);
  };

  const handleEdit = (config: WhatsAppConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      provider: config.provider,
      base_url: config.base_url,
      api_key: '', // API key is masked, user must re-enter if they want to change it
      instance_name: config.instance_name || '',
      phone_number: config.phone_number || '',
      is_active: config.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    // Usar schema apropriado baseado se é edição ou criação
    const schema = editingConfig ? whatsAppConfigEditSchema : whatsAppConfigSchema;
    const result = schema.safeParse(formData);

    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    if (editingConfig) {
      await updateMutation.mutateAsync({ id: editingConfig.id, ...formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleTestConnection = () => {
    testMutation.mutate({
      provider: formData.provider,
      base_url: formData.base_url,
      api_key: formData.api_key,
      instance_name: formData.instance_name,
    });
  };

  const handleToggleActive = async (config: WhatsAppConfig) => {
    await updateMutation.mutateAsync({ id: config.id, is_active: !config.is_active });
  };

  const handleSendTestMessage = (config: WhatsAppConfig) => {
    setTestMessageModal({
      open: true,
      instanceId: config.id,
      instanceName: config.name,
    });
    setTestPhone('');
  };

  const submitTestMessage = () => {
    if (!testPhone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }
    testMessageMutation.mutate(
      {
        whatsapp_instance_id: testMessageModal.instanceId,
        phone: testPhone,
      },
      {
        onSuccess: () => {
          setTestMessageModal({ open: false, instanceId: '', instanceName: '' });
          setTestPhone('');
        },
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência');
  };

  const providerInfo = PROVIDERS.find((p) => p.value === formData.provider);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageBreadcrumb
        items={[{ label: 'Configurações', href: '/settings' }, { label: 'WhatsApp' }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gateway WhatsApp</h1>
          <p className="text-muted-foreground">
            Configure a integração com WAHA, Evolution API ou Z-API
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Gateway
        </Button>
      </div>

      {/* Webhook URL Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" />
            URL do Webhook para receber mensagens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm">
              {webhookUrl}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Configure este URL no seu gateway WhatsApp para receber mensagens. Use Authorization:
            Bearer + sua API Key.
          </p>
        </CardContent>
      </Card>

      {/* Configs List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              Carregando...
            </CardContent>
          </Card>
        ) : configs?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Smartphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">Nenhum gateway configurado</h3>
              <p className="mb-4 text-muted-foreground">
                Configure um gateway WhatsApp para enviar e receber mensagens
              </p>
              <Button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Configurar gateway
              </Button>
            </CardContent>
          </Card>
        ) : (
          configs?.map((config) => (
            <Card key={config.id}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <Smartphone className="h-5 w-5 text-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{config.name}</h3>
                      <Badge variant={config.is_active ? 'default' : 'secondary'}>
                        {config.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        {PROVIDERS.find((p) => p.value === config.provider)?.label ||
                          config.provider}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{config.base_url}</p>
                    {config.phone_number && (
                      <p className="text-sm text-success">📱 {config.phone_number}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={() => handleToggleActive(config)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendTestMessage(config)}
                      disabled={!config.is_active}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Testar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(config)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteMutation.mutate(config.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
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

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Guia de Configuração
          </CardTitle>
          <CardDescription>Como configurar cada provedor de WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="waha">
              <AccordionTrigger>WAHA (WhatsApp HTTP API)</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>O WAHA é uma API HTTP open-source para WhatsApp.</p>
                <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
                  <li>
                    Rode o WAHA via Docker:{' '}
                    <code className="rounded bg-muted px-1">
                      docker run -it -p 3000:3000 devlikeapro/waha
                    </code>
                  </li>
                  <li>
                    Acesse o painel em{' '}
                    <code className="rounded bg-muted px-1">http://localhost:3000</code>
                  </li>
                  <li>Crie uma sessão e escaneie o QR Code</li>
                  <li>Configure o webhook apontando para a URL acima</li>
                  <li>Use o token de API como API Key</li>
                </ol>
                <Button variant="link" className="h-auto p-0" asChild>
                  <a
                    href="https://waha.devlike.pro/docs/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver documentação completa <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="evolution">
              <AccordionTrigger>Evolution API</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>
                  Evolution API é uma solução brasileira open-source com suporte a multi-device.
                </p>
                <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
                  <li>Instale via Docker ou servidor dedicado</li>
                  <li>Crie uma instância no painel</li>
                  <li>Conecte escaneando o QR Code</li>
                  <li>Configure o webhook em Settings → Webhooks</li>
                  <li>Use a API Key global ou da instância</li>
                </ol>
                <Button variant="link" className="h-auto p-0" asChild>
                  <a
                    href="https://doc.evolution-api.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver documentação completa <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="z-api">
              <AccordionTrigger>Z-API</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>Z-API é um serviço brasileiro pago com alta disponibilidade.</p>
                <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
                  <li>Crie uma conta em z-api.io</li>
                  <li>Crie uma instância e escaneie o QR</li>
                  <li>Copie o Client-Token da instância</li>
                  <li>Configure o webhook nas configurações da instância</li>
                </ol>
                <Button variant="link" className="h-auto p-0" asChild>
                  <a href="https://developer.z-api.io/" target="_blank" rel="noopener noreferrer">
                    Ver documentação completa <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Config Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Editar Gateway' : 'Novo Gateway WhatsApp'}</DialogTitle>
            <DialogDescription>Configure a conexão com seu provedor de WhatsApp</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da conexão *</Label>
              <Input
                placeholder="Ex: WhatsApp Principal"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Provedor *</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    provider: value as WhatsAppConfigInsert['provider'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      <div>
                        <p className="font-medium">{provider.label}</p>
                        <p className="text-xs text-muted-foreground">{provider.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {providerInfo?.docs && (
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <a href={providerInfo.docs} target="_blank" rel="noopener noreferrer">
                    Ver documentação <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>URL Base *</Label>
              <Input
                placeholder={
                  formData.provider === 'waha'
                    ? 'https://waha.seuservidor.com'
                    : formData.provider === 'evolution'
                      ? 'https://evolution.seuservidor.com'
                      : formData.provider === 'z-api'
                        ? 'https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN'
                        : 'https://seu-gateway.com/api'
                }
                value={formData.base_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, base_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>API Key / Token *</Label>
              <Input
                type="password"
                placeholder="Token de autenticação"
                value={formData.api_key}
                onChange={(e) => setFormData((prev) => ({ ...prev, api_key: e.target.value }))}
              />
            </div>

            {(formData.provider === 'waha' || formData.provider === 'evolution') && (
              <div className="space-y-2">
                <Label>Nome da Instância</Label>
                <Input
                  placeholder="default"
                  value={formData.instance_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, instance_name: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Nome da sessão/instância no gateway. Deixe vazio para usar "default".
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Número Conectado (opcional)</Label>
              <Input
                placeholder="+55 11 99999-9999"
                value={formData.phone_number}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label>Gateway ativo</Label>
            </div>

            {formData.base_url && formData.api_key && (
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sm">Teste a conexão antes de salvar</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : testMutation.isSuccess ? (
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    ) : testMutation.isError ? (
                      <XCircle className="mr-2 h-4 w-4 text-red-500" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Testar Conexão
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingConfig ? 'Salvar' : 'Criar Gateway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Message Modal */}
      <Dialog
        open={testMessageModal.open}
        onOpenChange={(open) => setTestMessageModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Enviar Mensagem de Teste
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem de teste via <strong>{testMessageModal.instanceName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número de destino (WhatsApp)</Label>
              <Input
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Digite o número com DDD (ex: 11999999999). O código 55 será adicionado
                automaticamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestMessageModal({ open: false, instanceId: '', instanceName: '' })}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitTestMessage}
              disabled={testMessageMutation.isPending || !testPhone.trim()}
            >
              {testMessageMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppSettings;
