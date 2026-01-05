import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Phone, Mail, DollarSign, Trash2, MessageSquare, Eye, Pencil, ExternalLink, Loader2 } from 'lucide-react';
import { useLeads, useLead, useCreateLead, useUpdateLead, useDeleteLead } from '@/hooks/useLeads';
import { getErrorWithFallback } from '@/lib/errorMessages';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLabels, useLeadLabels, useAddLeadLabel, useRemoveLeadLabel } from '@/hooks/useLabels';
import { cn } from '@/lib/utils';
import { MaskedInput } from '@/components/ui/masked-input';
import { formatPhone, formatPhoneNumber, formatCPF, unformatPhone, unformatCPF, toWhatsAppFormat } from '@/lib/masks';
import type { Database } from '@/integrations/supabase/types';

type LeadTemperature = Database['public']['Enums']['lead_temperature'];

const leadSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
  phone: z.string()
    .min(1, 'Telefone obrigatório')
    .refine((val) => {
      // Remove formatação e verifica se tem entre 10-11 dígitos (telefone BR)
      const digits = val.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    }, 'Telefone inválido (deve ter 10 ou 11 dígitos)'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cpf: z.string().optional().refine((val) => {
    if (!val) return true;
    const digits = val.replace(/\D/g, '');
    return digits.length === 0 || digits.length === 11;
  }, 'CPF deve ter 11 dígitos'),
  source: z.string().min(1, 'Origem obrigatória'),
  stage_id: z.string().optional(),
  temperature: z.enum(['cold', 'warm', 'hot']),
  estimated_value: z.number().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  mode?: 'view' | 'edit' | 'create';
}

export function LeadModal({ open, onOpenChange, leadId, mode = 'create' }: LeadModalProps) {
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState(mode);
  const { data: lead, isLoading: loadingLead } = useLead(leadId || undefined);
  const { data: stages } = useFunnelStages();
  const { data: allLabels } = useLabels();
  const { data: leadLabels } = useLeadLabels(leadId || undefined);
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const addLabel = useAddLeadLabel();
  const removeLabel = useRemoveLeadLabel();

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      cpf: '',
      source: 'manual',
      temperature: 'cold',
    },
  });

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  useEffect(() => {
    if (lead && leadId) {
      form.reset({
        name: lead.name,
        phone: formatPhone(lead.phone),
        email: lead.email || '',
        cpf: lead.cpf ? formatCPF(lead.cpf) : '',
        source: lead.source,
        stage_id: lead.stage_id || undefined,
        temperature: lead.temperature,
        estimated_value: lead.estimated_value || undefined,
      });
    } else if (!leadId) {
      form.reset({
        name: '',
        phone: '',
        email: '',
        cpf: '',
        source: 'manual',
        temperature: 'cold',
      });
    }
  }, [lead, leadId, form]);

  const handleSubmit = async (data: LeadFormData) => {
    try {
      const phoneDigits = unformatPhone(data.phone);
      const cpfDigits = data.cpf ? unformatCPF(data.cpf) : null;
      
      if (leadId && currentMode === 'edit') {
        await updateLead.mutateAsync({
          id: leadId,
          name: data.name,
          phone: phoneDigits,
          email: data.email || null,
          cpf: cpfDigits,
          source: data.source,
          stage_id: data.stage_id || null,
          temperature: data.temperature,
          estimated_value: data.estimated_value || null,
        });
        toast.success('Lead atualizado com sucesso');
      } else {
        await createLead.mutateAsync({
          name: data.name,
          phone: phoneDigits,
          email: data.email || null,
          cpf: cpfDigits,
          source: data.source,
          stage_id: data.stage_id || null,
          temperature: data.temperature,
          estimated_value: data.estimated_value || null,
        });
        toast.success('Lead criado com sucesso');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorWithFallback(error, 'Erro ao salvar lead'));
    }
  };

  const handleDelete = async () => {
    if (!leadId) return;
    try {
      await deleteLead.mutateAsync(leadId);
      toast.success('Lead excluído');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao excluir lead');
    }
  };

  const handleToggleLabel = async (labelId: string) => {
    if (!leadId) return;
    const hasLabel = leadLabels?.some((ll: any) => ll.label_id === labelId);
    if (hasLabel) {
      await removeLabel.mutateAsync({ leadId, labelId });
    } else {
      await addLabel.mutateAsync({ leadId, labelId });
    }
  };

  const openWhatsApp = () => {
    if (!lead) return;
    window.open(`https://wa.me/${toWhatsAppFormat(lead.phone)}`, '_blank');
  };

  const currentLabelIds = leadLabels?.map((ll: any) => ll.label_id) || [];
  const isViewMode = currentMode === 'view';
  const isLoading = loadingLead && !!leadId;

  const sourceOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'facebook', label: 'Facebook Ads' },
    { value: 'google', label: 'Google Ads' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'indicacao', label: 'Indicação' },
    { value: 'organico', label: 'Orgânico' },
  ];

  const DeleteButton = () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O lead "{lead?.name}" será permanentemente removido do sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentMode === 'create' ? 'Novo Lead' : currentMode === 'edit' ? 'Editar Lead' : 'Detalhes do Lead'}
          </DialogTitle>
          <DialogDescription>
            {currentMode === 'create' 
              ? 'Preencha os dados para criar um novo lead.' 
              : currentMode === 'edit' 
              ? 'Atualize as informações do lead.'
              : 'Visualize as informações do lead.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : isViewMode && lead ? (
          <div className="space-y-4">
            {/* Lead Header */}
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name || 'default'}`} />
                <AvatarFallback className="text-xl">{lead.name?.charAt(0) || '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{lead.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={cn(
                      'text-xs',
                      lead.temperature === 'hot' && 'bg-destructive/10 text-destructive',
                      lead.temperature === 'warm' && 'bg-warning/10 text-warning',
                      lead.temperature === 'cold' && 'bg-primary/10 text-primary'
                    )}
                  >
                    {lead.temperature === 'hot' ? '🔥 Quente' : lead.temperature === 'warm' ? '🌡️ Morno' : '❄️ Frio'}
                  </Badge>
                  {(lead as any).funnel_stages && (
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: (lead as any).funnel_stages.color,
                        color: (lead as any).funnel_stages.color,
                      }}
                    >
                      {(lead as any).funnel_stages.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentMode('edit')}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" onClick={openWhatsApp} aria-label="Abrir conversa no WhatsApp">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{formatPhoneNumber(lead.phone)}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.estimated_value && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="text-success font-medium">
                    R$ {lead.estimated_value.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-sm">Origem: </span>
                <span>{lead.source}</span>
              </div>
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Etiquetas</h4>
              <div className="flex flex-wrap gap-2">
                {allLabels?.map((label) => {
                  const isSelected = currentLabelIds.includes(label.id);
                  return (
                    <Badge
                      key={label.id}
                      className={cn(
                        'cursor-pointer transition-all',
                        isSelected ? 'ring-2 ring-offset-2' : 'opacity-60 hover:opacity-100'
                      )}
                      style={{
                        backgroundColor: isSelected ? label.color : 'transparent',
                        color: isSelected ? 'white' : label.color,
                        borderColor: label.color,
                      }}
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => handleToggleLabel(label.id)}
                    >
                      {label.name}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <DeleteButton />
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <MaskedInput
                          mask="phone"
                          placeholder="(00) 00000-0000"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (opcional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF (opcional)</FormLabel>
                      <FormControl>
                        <MaskedInput
                          mask="cpf"
                          placeholder="000.000.000-00"
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sourceOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperatura</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cold">❄️ Frio</SelectItem>
                          <SelectItem value="warm">🌡️ Morno</SelectItem>
                          <SelectItem value="hot">🔥 Quente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stage_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etapa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stages?.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="estimated_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Estimado (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0,00"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between pt-4">
                {leadId && currentMode === 'edit' && <DeleteButton />}
                <div className="flex gap-2 ml-auto">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="gradient-primary text-primary-foreground"
                    disabled={createLead.isPending || updateLead.isPending}
                  >
                    {(createLead.isPending || updateLead.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {leadId ? 'Salvar' : 'Criar Lead'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
