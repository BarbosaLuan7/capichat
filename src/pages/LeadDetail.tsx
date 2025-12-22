import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/appStore';
import { mockUsers, mockLabels, mockFunnelStages } from '@/data/mockData';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { LeadActivityTimeline } from '@/components/leads/LeadActivityTimeline';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, messages, updateLeadStage, updateLeadTemperature } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const lead = leads.find(l => l.id === id);
  const assignee = lead ? mockUsers.find(u => u.id === lead.assignedTo) : null;
  const stage = lead ? mockFunnelStages.find(s => s.id === lead.stageId) : null;
  const leadLabels = lead ? mockLabels.filter(l => lead.labelIds.includes(l.id)) : [];

  // Generate timeline events from messages and lead data
  const timelineEvents = lead ? [
    {
      id: 'created',
      type: 'assigned' as const,
      title: 'Lead criado',
      description: `Origem: ${lead.source}`,
      createdAt: lead.createdAt,
    },
    ...messages
      .filter(m => {
        const conv = useAppStore.getState().conversations.find(c => c.leadId === lead.id);
        return conv && m.conversationId === conv.id;
      })
      .map(m => ({
        id: m.id,
        type: 'message' as const,
        title: m.senderType === 'lead' ? 'Mensagem recebida' : 'Mensagem enviada',
        description: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
        createdAt: m.createdAt,
        user: m.senderType === 'agent' ? mockUsers.find(u => u.id === m.senderId)?.name : lead.name,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  if (!lead) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Lead não encontrado</h2>
        <Button onClick={() => navigate('/leads')}>Voltar para Leads</Button>
      </div>
    );
  }

  const temperatureColors = {
    cold: 'bg-blue-500',
    warm: 'bg-yellow-500',
    hot: 'bg-red-500',
  };

  const temperatureLabels = {
    cold: 'Frio',
    warm: 'Morno',
    hot: 'Quente',
  };

  const handleStageChange = (stageId: string) => {
    updateLeadStage(lead.id, stageId);
    toast({ title: 'Etapa atualizada!' });
  };

  const handleTemperatureChange = (temp: 'cold' | 'warm' | 'hot') => {
    updateLeadTemperature(lead.id, temp);
    toast({ title: 'Temperatura atualizada!' });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.phone}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Mail className="w-4 h-4" />
          </Button>
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
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                </Button>
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
                    value={lead.estimatedValue?.toLocaleString('pt-BR') || '0'}
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
                <Select value={lead.stageId} onValueChange={handleStageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockFunnelStages.map(s => (
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
                    >
                      <Thermometer className="w-3 h-3 mr-1" />
                      {temperatureLabels[temp]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                {assignee && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={assignee.avatar} />
                      <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{assignee.name}</p>
                      <p className="text-xs text-muted-foreground">{assignee.email}</p>
                    </div>
                  </div>
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
                {leadLabels.map(label => (
                  <Badge
                    key={label.id}
                    style={{ backgroundColor: label.color }}
                    className="text-white"
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
