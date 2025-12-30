import { useMemo, useState } from 'react';
import { Filter, MessageSquare, Tag, Users, Building, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConversationFilters } from '@/hooks/useConversationFilters';
import { useWhatsAppConfigs } from '@/hooks/useWhatsAppConfig';
import { useLabels } from '@/hooks/useLabels';
import { useProfiles } from '@/hooks/useProfiles';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface InboxWithCount {
  id: string;
  name: string;
  phone_number: string | null;
  conversationCount: number;
}

interface ConversationFiltersPopoverProps {
  availableInboxes: InboxWithCount[];
}

const categoryLabels: Record<string, string> = {
  origem: 'Origem',
  interesse: 'Benefício/Condição',
  prioridade: 'Prioridade',
  status: 'Status',
  beneficio: 'Benefício',
  condicao_saude: 'Condição de Saúde',
  desqualificacao: 'Desqualificação',
  situacao: 'Situação',
  perda: 'Motivo de Perda',
};

export function ConversationFiltersPopover({ availableInboxes }: ConversationFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  
  const { 
    filters, 
    toggleInbox, 
    setAllInboxes,
    clearInboxes,
    toggleLabel, 
    clearLabels,
    toggleUser,
    clearUsers,
    toggleTenant,
    clearTenants,
    clearAllFilters,
    getActiveFiltersCount 
  } = useConversationFilters();

  const { data: allLabels } = useLabels();
  const { data: profiles } = useProfiles();
  const { userTenants } = useTenant();

  const activeFiltersCount = getActiveFiltersCount();

  // Group labels by category
  const labelsByCategory = useMemo(() => {
    return allLabels?.reduce((acc, label) => {
      const category = label.category || 'outros';
      if (!acc[category]) acc[category] = [];
      acc[category].push(label);
      return acc;
    }, {} as Record<string, typeof allLabels>) || {};
  }, [allLabels]);

  // Filter labels by search term
  const filteredLabelsByCategory = useMemo(() => {
    if (!labelSearchTerm.trim()) return labelsByCategory;
    
    const term = labelSearchTerm.toLowerCase();
    const filtered: Record<string, typeof allLabels> = {};
    
    Object.entries(labelsByCategory).forEach(([category, labels]) => {
      const matchingLabels = labels?.filter(
        (label) => label.name.toLowerCase().includes(term)
      );
      if (matchingLabels?.length) {
        filtered[category] = matchingLabels;
      }
    });
    
    return filtered;
  }, [labelsByCategory, labelSearchTerm]);

  // Format phone for display
  const formatPhone = (phone: string | null, name: string) => {
    if (phone) {
      if (phone.startsWith('55') && phone.length >= 12) {
        const ddd = phone.slice(2, 4);
        const number = phone.slice(4);
        if (number.length === 9) {
          return `+55 ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
        }
        return `+55 ${ddd} ${number}`;
      }
      return `+${phone}`;
    }
    return name;
  };

  const handleSelectAllInboxes = () => {
    setAllInboxes(availableInboxes.map(i => i.id));
  };

  const handleDeselectAllInboxes = () => {
    clearInboxes();
  };

  // Only show tenants filter if user has access to more than one
  const showTenantsFilter = userTenants && userTenants.length > 1;

  return (
    <TooltipProvider>
      <Tooltip>
        <Popover open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-2 shrink-0 relative"
                aria-label="Filtros avançados"
              >
                <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                {activeFiltersCount > 0 && (
                  <Badge 
                    className="absolute -top-1.5 -right-1.5 h-4 min-w-4 p-0 text-2xs flex items-center justify-center px-1"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Filtros avançados</TooltipContent>
          
          <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">Filtros</span>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearAllFilters}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Filters */}
            <ScrollArea className="h-[400px]">
              <Accordion type="multiple" defaultValue={['inboxes', 'labels']} className="px-1">
                
                {/* Caixas de Entrada */}
                <AccordionItem value="inboxes" className="border-b-0">
                  <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Caixas de Entrada</span>
                      {filters.inboxIds.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-2xs">
                          {filters.inboxIds.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="space-y-1 px-2">
                      {/* Select/Deselect all */}
                      <div className="flex gap-2 mb-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs flex-1"
                          onClick={handleSelectAllInboxes}
                        >
                          Todas
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs flex-1"
                          onClick={handleDeselectAllInboxes}
                        >
                          Nenhuma
                        </Button>
                      </div>
                      
                      {availableInboxes.map((inbox) => (
                        <label
                          key={inbox.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={filters.inboxIds.includes(inbox.id)}
                            onCheckedChange={() => toggleInbox(inbox.id)}
                          />
                          <span className="text-sm flex-1 truncate">
                            {formatPhone(inbox.phone_number, inbox.name)}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {inbox.conversationCount}
                          </span>
                        </label>
                      ))}
                      
                      {availableInboxes.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhuma caixa configurada
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Etiquetas */}
                <AccordionItem value="labels" className="border-b-0">
                  <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Etiquetas</span>
                      {filters.labelIds.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-2xs">
                          {filters.labelIds.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="px-2 space-y-2">
                      {/* Search labels */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar etiqueta..."
                          value={labelSearchTerm}
                          onChange={(e) => setLabelSearchTerm(e.target.value)}
                          className="pl-8 h-7 text-sm"
                        />
                      </div>
                      
                      {filters.labelIds.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs w-full"
                          onClick={clearLabels}
                        >
                          Limpar etiquetas
                        </Button>
                      )}

                      <div className="space-y-3 max-h-[180px] overflow-y-auto">
                        {Object.entries(filteredLabelsByCategory).map(([category, labels]) => (
                          <div key={category}>
                            <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                              {categoryLabels[category] || category}
                            </p>
                            <div className="space-y-0.5">
                              {labels?.map((label) => (
                                <label
                                  key={label.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={filters.labelIds.includes(label.id)}
                                    onCheckedChange={() => toggleLabel(label.id)}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: label.color }}
                                  />
                                  <span className="text-sm truncate">{label.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        {Object.keys(filteredLabelsByCategory).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Nenhuma etiqueta encontrada
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Usuários */}
                <AccordionItem value="users" className="border-b-0">
                  <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Atribuído a</span>
                      {filters.userIds.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-2xs">
                          {filters.userIds.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="space-y-0.5 px-2">
                      {filters.userIds.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs w-full mb-2"
                          onClick={clearUsers}
                        >
                          Limpar usuários
                        </Button>
                      )}
                      
                      {/* Não atribuído */}
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={filters.userIds.includes('unassigned')}
                          onCheckedChange={() => toggleUser('unassigned')}
                        />
                        <span className="text-sm text-muted-foreground italic">Não atribuído</span>
                      </label>
                      
                      {profiles?.filter(p => p.is_active).map((profile) => (
                        <label
                          key={profile.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={filters.userIds.includes(profile.id)}
                            onCheckedChange={() => toggleUser(profile.id)}
                          />
                          <span className="text-sm truncate">{profile.name}</span>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Tenants */}
                {showTenantsFilter && (
                  <AccordionItem value="tenants" className="border-b-0">
                    <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Empresa</span>
                        {filters.tenantIds.length > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-2xs">
                            {filters.tenantIds.length}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="space-y-0.5 px-2">
                        {filters.tenantIds.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs w-full mb-2"
                            onClick={clearTenants}
                          >
                            Limpar empresas
                          </Button>
                        )}
                        
                        {userTenants?.map((ut) => (
                          <label
                            key={ut.tenant.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={filters.tenantIds.includes(ut.tenant.id)}
                              onCheckedChange={() => toggleTenant(ut.tenant.id)}
                            />
                            <span className="text-sm truncate">{ut.tenant.name}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  );
}
