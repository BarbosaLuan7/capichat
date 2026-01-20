import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useProfiles';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useChangePassword } from '@/hooks/useChangePassword';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Camera, Trash2, Save, Lock, Bell, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPreferences {
  browserNotifications: boolean;
  messageSound: boolean;
}

const MyAccountPage = () => {
  const { authUser } = useAuth();
  const updateProfile = useUpdateProfile();
  const { uploadAvatar, removeAvatar, uploading, progress } = useAvatarUpload();
  const { changePassword, isLoading: isChangingPassword } = useChangePassword();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [name, setName] = useState(authUser?.name || '');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(authUser?.avatar || '');

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    const saved = localStorage.getItem('notificationPreferences');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        browserNotifications: parsed.browserNotifications ?? true,
        messageSound: parsed.messageSound ?? true,
      };
    }
    return {
      browserNotifications: true,
      messageSound: true,
    };
  });

  // Load profile data
  useEffect(() => {
    if (authUser) {
      setName(authUser.name || '');
      setAvatarUrl(authUser.avatar || '');
    }
  }, [authUser]);

  // Save notification preferences to localStorage
  useEffect(() => {
    localStorage.setItem('notificationPreferences', JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser?.id) return;

    const result = await uploadAvatar(file, authUser.id);
    if (result.url) {
      setAvatarUrl(result.url);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!authUser?.id) return;
    const success = await removeAvatar(authUser.id);
    if (success) {
      setAvatarUrl('');
    }
  };

  const handleSaveProfile = async () => {
    if (!authUser?.id) return;

    try {
      await updateProfile.mutateAsync({
        id: authUser.id,
        name: name.trim(),
        nickname: nickname.trim() || null,
        phone: phone.trim() || null,
      });
      toast.success('Perfil atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    const result = await changePassword(newPassword);
    if (result.success) {
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleNotificationToggle = (key: keyof NotificationPreferences) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast.success('Preferência atualizada');
  };

  const getInitials = () => {
    if (!authUser?.name) return 'U';
    return authUser.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <PageBreadcrumb items={[{ label: 'Minha Conta' }]} />

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Foto de Perfil
          </CardTitle>
          <CardDescription>Sua foto será exibida nas conversas e no perfil</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={avatarUrl} alt={authUser?.name} />
                <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
                  <Progress value={progress} className="w-16" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarClick}
                  disabled={uploading}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Alterar foto
                </Button>
                {avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG, GIF ou WebP. Máximo 5MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
          <CardDescription>Atualize suas informações de perfil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Apelido</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Como gostaria de ser chamado"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={authUser?.email || ''} disabled className="bg-muted" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
            >
              {isChangingPassword ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>Configure como você deseja receber notificações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificações no navegador</Label>
              <p className="text-sm text-muted-foreground">
                Receba alertas quando novas mensagens chegarem
              </p>
            </div>
            <Switch
              checked={notificationPrefs.browserNotifications}
              onCheckedChange={() => handleNotificationToggle('browserNotifications')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Som de nova mensagem</Label>
              <p className="text-sm text-muted-foreground">
                Tocar um som ao receber novas mensagens
              </p>
            </div>
            <Switch
              checked={notificationPrefs.messageSound}
              onCheckedChange={() => handleNotificationToggle('messageSound')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAccountPage;
