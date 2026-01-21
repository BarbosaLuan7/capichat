import { useState, useEffect } from 'react';
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
  Smartphone,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { toast } from 'sonner';

interface NotificationPreferences {
  browserNotifications: boolean;
  messageSound: boolean;
  dailyEmailSummary: boolean;
}

const NOTIFICATION_PREFS_KEY = 'notification-preferences';

const settingsMenu = [
  { icon: Building2, label: 'Empresa', description: 'Informações da empresa', href: undefined },
  {
    icon: Users,
    label: 'Usuários',
    description: 'Gerenciar membros da equipe',
    href: '/settings/users',
  },
  { icon: Tag, label: 'Etiquetas', description: 'Configurar etiquetas', href: '/settings/labels' },
  {
    icon: MessageSquare,
    label: 'Templates',
    description: 'Mensagens rápidas',
    href: '/settings/templates',
  },
  { icon: Zap, label: 'Automações', description: 'Regras automáticas', href: '/automations' },
  {
    icon: Smartphone,
    label: 'WhatsApp',
    description: 'Gateway WAHA ou Meta Cloud API',
    href: '/settings/whatsapp',
  },
  {
    icon: Key,
    label: 'API & Integrações',
    description: 'Chaves de API e documentação',
    href: '/settings/api',
  },
  {
    icon: Database,
    label: 'Webhooks',
    description: 'Enviar dados para sistemas externos',
    href: '/settings/webhooks',
  },
  { icon: Bell, label: 'Notificações', description: 'Preferências de alertas', href: undefined },
  { icon: Palette, label: 'Aparência', description: 'Tema e personalização', href: undefined },
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { authUser: user } = useAuth();

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    const saved = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { browserNotifications: true, messageSound: true, dailyEmailSummary: false };
      }
    }
    return { browserNotifications: true, messageSound: true, dailyEmailSummary: false };
  });

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);

  const handleNotificationToggle = (key: keyof NotificationPreferences) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast.success('Preferência salva');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
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
          <div className="mb-6 flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="text-2xl">{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{user?.name}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="mt-1 text-sm capitalize text-primary">
                {user?.role === 'admin'
                  ? 'Administrador'
                  : user?.role === 'manager'
                    ? 'Gestor'
                    : 'Atendente'}
              </p>
            </div>
            <Button variant="outline" className="ml-auto">
              Editar Perfil
            </Button>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!item.href}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
            <Switch
              checked={notificationPrefs.browserNotifications}
              onCheckedChange={() => handleNotificationToggle('browserNotifications')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Som de nova mensagem</p>
              <p className="text-sm text-muted-foreground">Toque sonoro ao receber mensagens</p>
            </div>
            <Switch
              checked={notificationPrefs.messageSound}
              onCheckedChange={() => handleNotificationToggle('messageSound')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Resumo diário por email</p>
              <p className="text-sm text-muted-foreground">Relatório das atividades do dia</p>
            </div>
            <Switch
              checked={notificationPrefs.dailyEmailSummary}
              onCheckedChange={() => handleNotificationToggle('dailyEmailSummary')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
