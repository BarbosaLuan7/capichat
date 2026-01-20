import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Users, TrendingUp, MessageSquare, Thermometer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

type DrilldownType =
  | 'funnel_stage'
  | 'lead_source'
  | 'temperature'
  | 'conversation_status'
  | 'agent';

interface DrilldownConfig {
  type: DrilldownType;
  title: string;
  value?: string;
  id?: string;
  filter?: Record<string, any>;
}

interface MetricsDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DrilldownConfig | null;
}

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  temperature: string;
  source: string;
  created_at: string;
  funnel_stages?: { name: string; color: string } | null;
}

const typeIcons: Record<DrilldownType, React.ElementType> = {
  funnel_stage: TrendingUp,
  lead_source: Users,
  temperature: Thermometer,
  conversation_status: MessageSquare,
  agent: Users,
};

const temperatureColors: Record<string, string> = {
  cold: 'bg-temp-cold',
  warm: 'bg-temp-warm',
  hot: 'bg-temp-hot',
};

export function MetricsDrilldown({ open, onOpenChange, config }: MetricsDrilldownProps) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && config) {
      fetchLeads();
    }
  }, [open, config]);

  const fetchLeads = async () => {
    if (!config) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select(
          `
          id,
          name,
          phone,
          avatar_url,
          temperature,
          source,
          created_at,
          funnel_stages (name, color)
        `
        )
        .order('created_at', { ascending: false })
        .limit(50);

      // Aplicar filtros baseados no tipo
      switch (config.type) {
        case 'funnel_stage':
          if (config.id) {
            query = query.eq('stage_id', config.id);
          }
          break;
        case 'lead_source':
          if (config.value) {
            query = query.eq('source', config.value);
          }
          break;
        case 'temperature':
          if (config.value) {
            query = query.eq('temperature', config.value as 'cold' | 'warm' | 'hot');
          }
          break;
        case 'agent':
          if (config.id) {
            query = query.eq('assigned_to', config.id);
          }
          break;
        // Para conversation_status, precisamos buscar de forma diferente
        case 'conversation_status':
          // Buscar leads com conversas do status específico
          if (config.value) {
            const { data: convData } = await supabase
              .from('conversations')
              .select('lead_id')
              .eq('status', config.value as 'open' | 'pending' | 'resolved');

            const leadIds = convData?.map((c) => c.lead_id) || [];
            if (leadIds.length > 0) {
              query = query.in('id', leadIds);
            } else {
              setLeads([]);
              setIsLoading(false);
              return;
            }
          }
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      logger.error('Erro ao carregar leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
    onOpenChange(false);
  };

  const handleOpenInbox = (leadId: string) => {
    navigate(`/inbox?lead=${leadId}`);
    onOpenChange(false);
  };

  if (!config) return null;

  const Icon = typeIcons[config.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.value && (
              <Badge variant="outline" className="mt-1">
                {config.value}
              </Badge>
            )}
            <span className="ml-2">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} encontrado
              {leads.length !== 1 ? 's' : ''}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Nenhum lead encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={lead.avatar_url || undefined} />
                    <AvatarFallback>{lead.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{lead.name}</span>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          temperatureColors[lead.temperature] || 'bg-gray-400'
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{lead.phone}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(lead.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {lead.funnel_stages && (
                      <Badge variant="outline" style={{ borderColor: lead.funnel_stages.color }}>
                        {lead.funnel_stages.name}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {lead.source}
                    </Badge>
                  </div>

                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenInbox(lead.id)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleViewLead(lead.id)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Hook para usar o drilldown
export function useMetricsDrilldown() {
  const [config, setConfig] = useState<DrilldownConfig | null>(null);
  const [open, setOpen] = useState(false);

  const openDrilldown = (newConfig: DrilldownConfig) => {
    setConfig(newConfig);
    setOpen(true);
  };

  const closeDrilldown = () => {
    setOpen(false);
    setConfig(null);
  };

  return {
    config,
    open,
    setOpen,
    openDrilldown,
    closeDrilldown,
  };
}
