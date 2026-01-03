import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Edit2,
  Save,
  X,
  Tag,
  DollarSign,
  Calendar,
  User,
  Thermometer,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLeadLabels } from '@/hooks/useLabels';
import { useProfiles } from '@/hooks/useProfiles';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { LeadActivityTimeline } from '@/components/leads/LeadActivityTimeline';
import { cn, getContrastTextColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type LeadTemperature = Database['public']['Enums']['lead_temperature'];

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: lead, isLoading: leadLoading } = useLead(id);
  const { data: stages } = useFunnelStages();
  const { data: leadLabelsData } = useLeadLabels(id);
  const { data: profiles } = useProfiles();
  const updateLead = useUpdateLead();
  
  const [isEditing, setIsEditing] = useState(false);

  const assignee = lead && profiles ? profiles.find(u => u.id === lead.assigned_to) : null;
  const stage = lead && stages ? stages.find(s => s.id === lead.stage_id) : null;
  const leadLabels = leadLabelsData?.map(ll => ll.labels).filter(Boolean) || [];

  // Generate timeline events from lead data
  const timelineEvents = lead ? [
    {
      id: 'created',
      type: 'assigned' as const,
      title: 'Lead criado',
      description: `Origem: ${lead.source}`,
      createdAt: new Date(lead.created_at),
    },
  ] : [];

  if (leadLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="lg:col-span-2 h-[400px]" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Lead não encontrado</h2>
        <Button onClick={() => navigate('/leads')}>Voltar para Leads</Button>
      </div>
    );
  }

  const temperatureColors: Record<LeadTemperature, string> = {
    cold: 'bg-temp-cold',
    warm: 'bg-temp-warm',
    hot: 'bg-temp-hot',
  };

  const temperatureLabels: Record<LeadTemperature, string> = {
    cold: 'Frio',
    warm: 'Morno',
    hot: 'Quente',
  };

  const handleStageChange = async (stageId: string) => {
    try {
      await updateLead.mutateAsync({ id: lead.id, stage_id: stageId });
      toast({ title: 'Etapa atualizada!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar etapa', variant: 'destructive' });
    }
  };

  const handleTemperatureChange = async (temp: LeadTemperature) => {
    try {
      await updateLead.mutateAsync({ id: lead.id, temperature: temp });
      toast({ title: 'Temperatura atualizada!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar temperatura', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Voltar para leads</TooltipContent>
        </Tooltip>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.phone}</p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <Phone className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ligar para {lead.phone}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <Mail className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar email</TooltipContent>
          </Tooltip>
          <Button onClick={() => navigate('/inbox')} className="gradient-primary text-primary-foreground gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Lead Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Informações</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)}>
                      {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isEditing ? 'Cancelar edição' : 'Editar informações'}</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={lead.name} disabled={!isEditing} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={lead.phone} disabled={!isEditing} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={lead.email || ''} disabled={!isEditing} placeholder="Não informado" />
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input value={lead.source} disabled />
              </div>
              <div className="space-y-2">
                <Label>Valor Estimado</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={lead.estimated_value?.toLocaleString('pt-BR') || '0'}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              {isEditing && (
                <Button className="w-full gradient-primary text-primary-foreground">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stage & Temperature */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Etapa do Funil</Label>
                <Select value={lead.stage_id || ''} onValueChange={handleStageChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages?.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Temperatura</Label>
                <div className="flex gap-2">
                  {(['cold', 'warm', 'hot'] as const).map(temp => (
                    <Button
                      key={temp}
                      variant={lead.temperature === temp ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'flex-1',
                        lead.temperature === temp && temperatureColors[temp],
                        lead.temperature === temp && 'text-white'
                      )}
                      onClick={() => handleTemperatureChange(temp)}
                      disabled={updateLead.isPending}
                    >
                      {updateLead.isPending && lead.temperature !== temp ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Thermometer className="w-3 h-3 mr-1" />
                      )}
                      {temperatureLabels[temp]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                {assignee ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={assignee.avatar || undefined} />
                      <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{assignee.name}</p>
                      <p className="text-xs text-muted-foreground">{assignee.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não atribuído</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Labels */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Etiquetas</CardTitle>
                <Button variant="ghost" size="sm">
                  <Tag className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {leadLabels.map(label => label && (
                  <Badge
                    key={label.id}
                    style={{ backgroundColor: label.color }}
                    className={getContrastTextColor(label.color)}
                  >
                    {label.name}
                  </Badge>
                ))}
                {leadLabels.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma etiqueta</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Timeline & Activity */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="activity">Atividades</TabsTrigger>
                  <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                  <TabsTrigger value="notes">Notas</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4">
                  <LeadTimeline events={timelineEvents} />
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <LeadActivityTimeline leadId={id!} />
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma tarefa vinculada</p>
                    <Button variant="outline" className="mt-4">
                      Criar Tarefa
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma nota adicionada</p>
                    <Button variant="outline" className="mt-4">
                      Adicionar Nota
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
