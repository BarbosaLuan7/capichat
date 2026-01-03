import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useUpdateProfile, useUpdateUserRole, type ProfileWithRelations } from '@/hooks/useProfiles';
import { getRoleLabel, getRoleDescription, SELECTABLE_ROLES } from '@/lib/permissions';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  nickname: z.string().optional(),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'agent', 'viewer']),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRelations | null;
  userRole: AppRole;
}

export const UserEditModal = ({
  open,
  onOpenChange,
  user,
  userRole,
}: UserEditModalProps) => {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const updateUserRole = useUpdateUserRole();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      nickname: '',
      email: '',
      phone: '',
      role: 'agent',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        nickname: user.nickname || '',
        email: user.email,
        phone: user.phone || '',
        role: userRole,
      });
    }
  }, [user, userRole, form]);

  const handleSubmit = async (data: UserFormData) => {
    if (!user) return;

    try {
      // Atualizar perfil
      await updateProfile.mutateAsync({
        id: user.id,
        name: data.name,
        nickname: data.nickname || null,
        phone: data.phone || null,
      });

      // Atualizar role se mudou
      if (data.role !== userRole) {
        await updateUserRole.mutateAsync({
          userId: user.id,
          role: data.role as AppRole,
        });
      }

      toast({ title: 'Usuário atualizado!' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const isLoading = updateProfile.isPending || updateUserRole.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Informações do usuário</SheetTitle>
          <SheetDescription>Editar dados e perfil de acesso do usuário</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-5">
              {/* Nome */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome completo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Apelido */}
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apelido</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Apelido para atendimento" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" disabled className="bg-muted" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Telefone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(00) 00000-0000" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Perfil de Acesso */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil de acesso *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SELECTABLE_ROLES.map(role => (
                          <SelectItem key={role} value={role} className="py-3">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{getRoleLabel(role)}</span>
                              <span className="text-xs text-muted-foreground max-w-[280px] whitespace-normal">
                                {getRoleDescription(role)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ID (readonly) */}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Id: <span className="font-mono">{user?.id}</span>
                </p>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
