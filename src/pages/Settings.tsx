import { useNavigate } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Settings,
  Key,
  Bell,
  Palette,
  Database,
  Zap,
  Tag,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';

const settingsMenu = [
  { icon: Building2, label: 'Empresa', description: 'Informações da empresa', href: undefined },
  { icon: Users, label: 'Usuários', description: 'Gerenciar membros da equipe', href: '/settings/users' },
  { icon: Tag, label: 'Etiquetas', description: 'Configurar etiquetas', href: '/settings/labels' },
  { icon: MessageSquare, label: 'Templates', description: 'Mensagens rápidas', href: '/settings/templates' },
  { icon: Zap, label: 'Automações', description: 'Regras automáticas', href: '/automations' },
  { icon: Key, label: 'API & Integrações', description: 'Chaves de API e documentação', href: '/settings/api' },
  { icon: Database, label: 'Webhooks', description: 'Enviar dados para sistemas externos', href: '/settings/webhooks' },
  { icon: Bell, label: 'Notificações', description: 'Preferências de alertas', href: undefined },
  { icon: Palette, label: 'Aparência', description: 'Tema e personalização', href: undefined },
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageBreadcrumb items={[{ label: 'Configurações' }]} />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do seu sistema</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>Suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="text-2xl">{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg text-foreground">{user?.name}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="text-sm text-primary capitalize mt-1">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gestor' : 'Atendente'}
              </p>
            </div>
            <Button variant="outline" className="ml-auto">
              Editar Perfil
            </Button>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input defaultValue={user?.name} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" defaultValue={user?.email} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Menu */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Sistema</CardTitle>
          <CardDescription>Acesse as configurações disponíveis</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {settingsMenu.map((item) => (
              <button
                key={item.label}
                onClick={() => item.href && navigate(item.href)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!item.href}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>Configure como você recebe alertas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Notificações no navegador</p>
              <p className="text-sm text-muted-foreground">Receba alertas em tempo real</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Som de nova mensagem</p>
              <p className="text-sm text-muted-foreground">Toque sonoro ao receber mensagens</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Resumo diário por email</p>
              <p className="text-sm text-muted-foreground">Relatório das atividades do dia</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
