import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Key, 
  MoreVertical, 
  Trash2, 
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink
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
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Generate a random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'gd_live_';
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Hash function (simple SHA-256 simulation for display - real hashing happens in backend)
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const ApiSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const key = generateApiKey();
      const keyHash = await hashKey(key);
      const keyPrefix = key.substring(0, 12) + '...';

      const { error } = await supabase.from('api_keys').insert({
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      });

      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyValue(key);
      setIsCreateModalOpen(false);
      setIsKeyModalOpen(true);
      setNewKeyName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar API Key', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setIsDeleteDialogOpen(false);
      setSelectedKeyId(null);
      toast({ title: 'API Key excluída com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir API Key', description: error.message, variant: 'destructive' });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
    toast({ title: 'Copiado para a área de transferência' });
  };

  const handleDelete = (id: string) => {
    setSelectedKeyId(id);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageBreadcrumb items={[
        { label: 'Configurações', href: '/settings' },
        { label: 'API' }
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API & Integrações</h1>
          <p className="text-muted-foreground">Gerencie API Keys para integrar com sistemas externos</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova API Key
        </Button>
      </div>

      {/* Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentação da API</CardTitle>
          <CardDescription>
            Use a API REST para integrar o CRM com seus sistemas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Endpoints disponíveis:</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><code className="bg-muted px-1 rounded">POST /api-leads</code> - Criar lead</p>
                <p><code className="bg-muted px-1 rounded">GET /api-leads?phone=xxx</code> - Buscar por telefone</p>
                <p><code className="bg-muted px-1 rounded">PUT /api-leads?id=xxx</code> - Atualizar lead</p>
                <p><code className="bg-muted px-1 rounded">DELETE /api-leads?id=xxx</code> - Excluir lead</p>
                <p><code className="bg-muted px-1 rounded">POST /api-messages-receive</code> - Receber mensagem</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Autenticação:</h4>
              <div className="text-sm text-muted-foreground">
                <p>Inclua o header em todas as requisições:</p>
                <pre className="bg-muted p-2 rounded mt-2 text-xs overflow-x-auto">
                  Authorization: Bearer sua_api_key
                </pre>
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Exemplo de criação de lead:</h4>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`curl -X POST \\
  https://vnsypopnzwtkmyvxvqpu.supabase.co/functions/v1/api-leads \\
  -H "Authorization: Bearer sua_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Maria Silva",
    "phone": "+5511999999999",
    "email": "maria@email.com",
    "benefit_type": "bpc_idoso",
    "utm_source": "facebook"
  }'`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Keys</CardTitle>
          <CardDescription>
            Chaves de acesso para autenticação na API
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : apiKeys?.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma API Key criada</h3>
              <p className="text-muted-foreground mb-4">
                Crie uma API Key para começar a usar a API
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys?.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{apiKey.name}</h3>
                      <Badge variant={apiKey.is_active ? 'default' : 'secondary'}>
                        {apiKey.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      {apiKey.key_prefix}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Criada em {format(new Date(apiKey.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {apiKey.last_used_at && (
                        <span>
                          Último uso: {format(new Date(apiKey.last_used_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      <span>
                        {apiKey.usage_count} requisições
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={apiKey.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: apiKey.id, is_active: checked })
                      }
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(apiKey.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Revogar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
            <DialogDescription>
              Crie uma nova chave de acesso para a API
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da API Key</Label>
              <Input
                placeholder="Ex: Integração n8n, Webhook WhatsApp"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use um nome descritivo para identificar onde a chave será usada
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newKeyName)}
              disabled={!newKeyName || createMutation.isPending}
            >
              {createMutation.isPending ? 'Criando...' : 'Criar API Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Modal */}
      <Dialog open={isKeyModalOpen} onOpenChange={(open) => {
        if (!open) {
          setNewKeyValue('');
          setShowKey(false);
        }
        setIsKeyModalOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              API Key Criada
            </DialogTitle>
            <DialogDescription>
              Copie sua API Key agora. Ela não será exibida novamente!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
              <p className="text-sm text-warning">
                Guarde esta chave em um local seguro. Por segurança, ela não pode ser visualizada novamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sua API Key</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    readOnly
                    type={showKey ? 'text' : 'password'}
                    value={newKeyValue}
                    className="font-mono pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(newKeyValue)}
                >
                  {keyCopied ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setIsKeyModalOpen(false);
              setNewKeyValue('');
              setShowKey(false);
            }}>
              Entendi, já copiei
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as integrações que usam esta chave deixarão de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => selectedKeyId && deleteMutation.mutate(selectedKeyId)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApiSettings;
