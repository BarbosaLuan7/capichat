import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Phone, Link2, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfiles } from '@/hooks/useProfiles';
import { useWhatsAppConfigs } from '@/hooks/useWhatsAppConfig';
import { toast } from 'sonner';
import type { TeamWithRelations } from '@/hooks/useTeams';

const teamSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  isDefault: z.boolean().default(false),
  accessLevel: z.enum(['all', 'team', 'attendant']).default('team'),
  autoDistribution: z.boolean().default(false),
  whatsappConfigIds: z.array(z.string()),
  members: z.array(
    z.object({
      userId: z.string(),
      isSupervisor: z.boolean(),
    })
  ),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: TeamWithRelations | null;
  onSave: (data: TeamFormData & { id?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function TeamModal({ open, onOpenChange, team, onSave, isLoading = false }: TeamModalProps) {
  const { data: profiles } = useProfiles();
  const { data: whatsappConfigs } = useWhatsAppConfigs();

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      isDefault: false,
      accessLevel: 'team',
      autoDistribution: false,
      whatsappConfigIds: [],
      members: [],
    },
  });

  // Reset form quando team mudar
  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        isDefault: team.is_default || false,
        accessLevel: (team.access_level as 'all' | 'team' | 'attendant') || 'team',
        autoDistribution: team.auto_distribution || false,
        whatsappConfigIds: team.team_whatsapp_configs?.map((c) => c.whatsapp_config_id) || [],
        members:
          team.team_members?.map((m) => ({
            userId: m.user_id,
            isSupervisor: m.is_supervisor,
          })) || [],
      });
    } else {
      form.reset({
        name: '',
        isDefault: false,
        accessLevel: 'team',
        autoDistribution: false,
        whatsappConfigIds: [],
        members: [],
      });
    }
  }, [team, form, open]);

  const handleSubmit = async (data: TeamFormData) => {
    try {
      await onSave({ ...data, id: team?.id });
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const members = form.watch('members');
  const whatsappConfigIds = form.watch('whatsappConfigIds');

  // Toggle membro (adicionar/remover)
  const toggleMember = (userId: string) => {
    const current = form.getValues('members');
    const exists = current.find((m) => m.userId === userId);

    if (exists) {
      form.setValue(
        'members',
        current.filter((m) => m.userId !== userId)
      );
    } else {
      form.setValue('members', [...current, { userId, isSupervisor: false }]);
    }
  };

  // Toggle supervisor de um membro
  const toggleSupervisor = (userId: string) => {
    const current = form.getValues('members');
    form.setValue(
      'members',
      current.map((m) => (m.userId === userId ? { ...m, isSupervisor: !m.isSupervisor } : m))
    );
  };

  // Toggle canal WhatsApp
  const toggleWhatsAppConfig = (configId: string) => {
    const current = form.getValues('whatsappConfigIds');
    if (current.includes(configId)) {
      form.setValue(
        'whatsappConfigIds',
        current.filter((id) => id !== configId)
      );
    } else {
      form.setValue('whatsappConfigIds', [...current, configId]);
    }
  };

  // Gerar link de atendimento direto
  const generateDirectLink = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[600px]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-lg font-semibold">
            {team ? 'Editar Equipe' : 'Nova Equipe'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 p-6">
              {/* Nome */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Equipe de Vendas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Equipe Padrão */}
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Equipe padrão</FormLabel>
                      <FormDescription>
                        Será atribuído a um atendimento quando não for possível determinar a equipe
                        correta.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />

              {/* Canal da Equipe (WhatsApp Configs) */}
              <div className="space-y-3">
                <div>
                  <FormLabel className="text-base">Canal da equipe</FormLabel>
                  <FormDescription>Defina o canal que a equipe terá acesso</FormDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  {whatsappConfigs?.map((config) => (
                    <Badge
                      key={config.id}
                      variant={whatsappConfigIds.includes(config.id) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleWhatsAppConfig(config.id)}
                    >
                      <Phone className="mr-1 h-3 w-3" />
                      {config.phone_number || config.name}
                    </Badge>
                  ))}
                </div>

                {(!whatsappConfigs || whatsappConfigs.length === 0) && (
                  <p className="text-sm text-muted-foreground">Nenhum canal WhatsApp configurado</p>
                )}
              </div>

              <Separator />

              {/* Acesso aos Atendimentos */}
              <FormField
                control={form.control}
                name="accessLevel"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <div>
                      <FormLabel className="text-base">Acesso aos atendimentos</FormLabel>
                      <FormDescription>
                        Defina abaixo quem poderá visualizar os atendimentos dessa equipe após o
                        início do atendimento
                      </FormDescription>
                    </div>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        className="space-y-3"
                      >
                        <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                          <FormControl>
                            <RadioGroupItem value="all" />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="font-medium">Todos</FormLabel>
                            <FormDescription>
                              Visível aos usuários desta equipe na aba Outros e a todos os usuários
                              na aba Concluídos.
                            </FormDescription>
                          </div>
                        </FormItem>

                        <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                          <FormControl>
                            <RadioGroupItem value="team" />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="font-medium">Equipe</FormLabel>
                            <FormDescription>
                              Visível apenas aos usuários desta equipe nas abas Outros e Concluídos.
                            </FormDescription>
                          </div>
                        </FormItem>

                        <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                          <FormControl>
                            <RadioGroupItem value="attendant" />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="font-medium">Atendente</FormLabel>
                            <FormDescription>
                              Visível apenas ao atendente da conversa e aos supervisores desta
                              equipe nas abas Outros e Concluídos.
                            </FormDescription>
                          </div>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Distribuição de Atendimentos */}
              <FormField
                control={form.control}
                name="autoDistribution"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Distribuição de atendimentos</FormLabel>
                      <FormDescription>
                        Direcione os atendimentos para os usuários dessa equipe de forma automática.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />

              {/* Usuários */}
              <div className="space-y-3">
                <div>
                  <FormLabel className="text-base">Usuários</FormLabel>
                  <FormDescription>
                    Defina em quais usuários poderão atender aos clientes nessa equipe
                  </FormDescription>
                </div>

                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {profiles?.map((profile) => {
                    const memberData = members.find((m) => m.userId === profile.id);
                    const isActive = !!memberData;
                    const isSup = memberData?.isSupervisor || false;

                    return (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {profile.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{profile.name}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Toggle Usuário */}
                          <label className="flex cursor-pointer items-center gap-2">
                            <Switch
                              checked={isActive}
                              onCheckedChange={() => toggleMember(profile.id)}
                            />
                            <span className="text-sm text-muted-foreground">Usuário</span>
                          </label>

                          {/* Toggle Supervisor (só aparece se for membro) */}
                          <label className="flex cursor-pointer items-center gap-2">
                            <Switch
                              checked={isSup}
                              onCheckedChange={() => toggleSupervisor(profile.id)}
                              disabled={!isActive}
                            />
                            <span className="text-sm text-muted-foreground">Supervisor</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  {(!profiles || profiles.length === 0) && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Nenhum usuário disponível
                    </p>
                  )}
                </div>
              </div>

              {/* Links de Atendimento Direto (só mostra em edição) */}
              {team && whatsappConfigIds.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <FormLabel className="text-base">Link para atendimento direto</FormLabel>
                    <div className="space-y-2">
                      {whatsappConfigs
                        ?.filter((c) => whatsappConfigIds.includes(c.id))
                        .map((config) => (
                          <div
                            key={config.id}
                            className="flex items-center justify-between rounded-lg border bg-muted/50 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {config.phone_number || config.name}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (config.phone_number) {
                                  navigator.clipboard.writeText(
                                    generateDirectLink(config.phone_number)
                                  );
                                  toast.success('Link copiado!');
                                }
                              }}
                            >
                              <Link2 className="mr-1 h-4 w-4" />
                              Gerar link
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              {/* Botões */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="gradient-primary text-primary-foreground"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
