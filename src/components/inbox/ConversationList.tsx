import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  Filter,
  Tag,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationStatusTabs } from '@/components/inbox/ConversationStatusTabs';
import { ConversationItem } from '@/components/inbox/ConversationItem';
import { InboxFilter } from '@/components/inbox/InboxFilter';
import { useDebounce } from '@/hooks/useDebounce';
import { useLabels } from '@/hooks/useLabels';
import { useWhatsAppConfigs } from '@/hooks/useWhatsAppConfig';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

const CONVERSATION_ITEM_HEIGHT = 88; // Approximate height of ConversationItem in px
const INBOX_FILTER_STORAGE_KEY = 'inbox-filter-selected';

// Wrapper to prevent inline onClick from breaking React.memo
const MemoizedConversationItem = React.memo(function MemoizedConversationItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: ConversationData;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(conversation.id);
  }, [onSelect, conversation.id]);

  return (
    <ConversationItem
      conversation={conversation}
      isSelected={isSelected}
      onClick={handleClick}
    />
  );
});

type ConversationStatus = Database['public']['Enums']['conversation_status'];
type StatusFilter = ConversationStatus | 'all';
type AssignmentFilter = 'novos' | 'meus' | 'outros';

interface WhatsAppConfigData {
  id: string;
  name: string;
  phone_number: string | null;
  tenant_id: string | null;
}

interface ConversationData {
  id: string;
  status: ConversationStatus;
  last_message_at: string;
  last_message_content?: string | null;
  unread_count: number;
  is_favorite?: boolean | null;
  assigned_to?: string | null;
  created_at: string;
  leads?: any;
  whatsapp_config?: WhatsAppConfigData | null;
}

interface ConversationListProps {
  conversations: ConversationData[] | undefined;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  userId?: string;
  // Infinite scroll props
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
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

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  isLoading,
  isError,
  onRetry,
  userId,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: ConversationListProps) {
  const [filter, setFilter] = useState<AssignmentFilter>('meus');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  
  // State for inbox (WhatsApp number) filter - initialized from localStorage
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(INBOX_FILTER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Ref for virtual list container
  const parentRef = useRef<HTMLDivElement>(null);

  // Track if user is authenticated
  const isUserAuthenticated = Boolean(userId);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch labels
  const { data: allLabels } = useLabels();

  // Fetch all WhatsApp configs (inboxes)
  const { data: whatsAppConfigs } = useWhatsAppConfigs();

  // Build available inboxes from whatsapp_config table with conversation counts
  const availableInboxes = useMemo(() => {
    if (!whatsAppConfigs) return [];
    
    // Count conversations per inbox
    const countMap = new Map<string, number>();
    conversations?.forEach((conv) => {
      if (conv.whatsapp_config?.id) {
        countMap.set(conv.whatsapp_config.id, (countMap.get(conv.whatsapp_config.id) || 0) + 1);
      }
    });
    
    // Return all active configs with their counts
    return whatsAppConfigs
      .filter((config) => config.is_active)
      .map((config) => ({
        id: config.id,
        name: config.name,
        phone_number: config.phone_number,
        conversationCount: countMap.get(config.id) || 0,
      }))
      .sort((a, b) => (a.phone_number || a.name).localeCompare(b.phone_number || b.name));
  }, [whatsAppConfigs, conversations]);

  // Initialize selectedInboxIds with all inboxes if empty
  useEffect(() => {
    if (selectedInboxIds.length === 0 && availableInboxes.length > 0) {
      const allIds = availableInboxes.map((i) => i.id);
      setSelectedInboxIds(allIds);
    }
  }, [availableInboxes, selectedInboxIds.length]);

  // Persist inbox filter to localStorage
  useEffect(() => {
    if (selectedInboxIds.length > 0) {
      localStorage.setItem(INBOX_FILTER_STORAGE_KEY, JSON.stringify(selectedInboxIds));
    }
  }, [selectedInboxIds]);

  // Inbox filter handlers
  const handleToggleInbox = useCallback((inboxId: string) => {
    setSelectedInboxIds((prev) =>
      prev.includes(inboxId)
        ? prev.filter((id) => id !== inboxId)
        : [...prev, inboxId]
    );
  }, []);

  const handleSelectAllInboxes = useCallback(() => {
    const allIds = availableInboxes.map((i) => i.id);
    if (selectedInboxIds.length === allIds.length) {
      // If all selected, deselect all
      setSelectedInboxIds([]);
    } else {
      // Select all
      setSelectedInboxIds(allIds);
    }
  }, [availableInboxes, selectedInboxIds.length]);

  // Filter conversations by inbox (WhatsApp number) first
  const inboxFilteredConversations = useMemo(() => {
    // If no inboxes selected or all are selected, show all
    if (selectedInboxIds.length === 0 || selectedInboxIds.length === availableInboxes.length) {
      return conversations || [];
    }
    return (conversations || []).filter((conv) =>
      conv.whatsapp_config?.id && selectedInboxIds.includes(conv.whatsapp_config.id)
    );
  }, [conversations, selectedInboxIds, availableInboxes.length]);

  // Filter conversations by assignment (for accurate status counts)
  const assignmentFilteredConversations = useMemo(() => {
    // Handle unauthenticated user for assignment-based filters
    if (!isUserAuthenticated && (filter === 'meus' || filter === 'outros')) {
      logger.warn('[ConversationList] userId undefined - cannot filter by assignment');
      return [];
    }

    return inboxFilteredConversations.filter((conv) => {
      if (filter === 'novos') {
        // Novos = não atribuídos a ninguém
        return !conv.assigned_to;
      } else if (filter === 'meus') {
        return conv.assigned_to === userId;
      } else if (filter === 'outros') {
        return !!conv.assigned_to && conv.assigned_to !== userId;
      }
      return true;
    });
  }, [inboxFilteredConversations, filter, userId, isUserAuthenticated]);

  // Clear search handler
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Calculate status counts based on assignment-filtered conversations
  const statusCounts = useMemo(() => {
    const counts = { all: 0, open: 0, pending: 0, resolved: 0 };
    assignmentFilteredConversations.forEach((conv) => {
      counts.all++;
      if (conv.status === 'open') counts.open++;
      else if (conv.status === 'pending') counts.pending++;
      else if (conv.status === 'resolved') counts.resolved++;
    });
    return counts;
  }, [assignmentFilteredConversations]);

  // Group labels by category (memoized)
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

  // Filter and sort conversations (uses pre-filtered by assignment)
  const filteredConversations = useMemo(() => {
    let filtered = assignmentFilteredConversations.filter((conv) => {
      // Filter by status tab
      if (statusFilter !== 'all' && conv.status !== statusFilter) {
        return false;
      }
      
      const searchLower = debouncedSearchQuery.toLowerCase();
      const matchesSearch = !debouncedSearchQuery || 
        conv.leads?.name?.toLowerCase().includes(searchLower) ||
        conv.leads?.phone?.includes(debouncedSearchQuery) ||
        conv.leads?.whatsapp_name?.toLowerCase().includes(searchLower);

      // Filter by labels
      const matchesLabels = selectedLabelIds.length === 0 || 
        selectedLabelIds.some((labelId) => 
          conv.leads?.lead_labels?.some((ll: any) => ll.labels?.id === labelId)
        );

      return matchesSearch && matchesLabels;
    });

    // Sort by date
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.last_message_at).getTime();
      const dateB = new Date(b.last_message_at).getTime();
      return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [assignmentFilteredConversations, statusFilter, debouncedSearchQuery, selectedLabelIds, sortOrder]);

  const toggleLabelFilter = useCallback((labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  }, []);

  const clearLabelFilters = useCallback(() => {
    setSelectedLabelIds([]);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header with New Conversation Button */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-card">
        <span className="font-semibold text-sm">Conversas</span>
        <Button
          size="sm"
          onClick={onNewConversation}
          className="h-7 gap-1 text-xs px-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova
        </Button>
      </div>
      
      {/* Search, Filters and Tabs - Compact Layout */}
      <div className="p-2 space-y-2 border-b border-border bg-card sticky top-0 z-30 shadow-sm isolate">
        {/* Search + Labels + Sort in one row */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <Input 
              placeholder="Buscar nome, telefone..." 
              className={cn("pl-8 h-8 text-sm", searchQuery && "pr-8")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar conversas"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={handleClearSearch}
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1 px-2 shrink-0" aria-label="Filtrar por etiquetas">
                      <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                      {selectedLabelIds.length > 0 && (
                        <Badge variant="secondary" className="px-1 py-0 text-2xs h-4 min-w-4 flex items-center justify-center">
                          {selectedLabelIds.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end">
                    <div className="p-3 border-b border-border bg-popover shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Filtrar por etiquetas</span>
                        {selectedLabelIds.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearLabelFilters}>
                            Limpar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                        <Input
                          placeholder="Buscar etiqueta..."
                          value={labelSearchTerm}
                          onChange={(e) => setLabelSearchTerm(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          aria-label="Buscar etiqueta"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[280px]">
                      <div className="p-2 space-y-3">
                        {Object.entries(filteredLabelsByCategory).map(([category, labels]) => (
                          <div key={category}>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                              {categoryLabels[category] || category}
                            </p>
                            <div className="space-y-0.5">
                              {labels?.map((label) => (
                                <label
                                  key={label.id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={selectedLabelIds.includes(label.id)}
                                    onCheckedChange={() => toggleLabelFilter(label.id)}
                                    aria-label={`Filtrar por ${label.name}`}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                    aria-hidden="true"
                                  />
                                  <span className="text-sm">{label.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        {Object.keys(filteredLabelsByCategory).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma etiqueta encontrada
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </TooltipTrigger>
              <TooltipContent side="bottom">Filtrar por etiquetas</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Sort Dropdown */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" aria-label="Ordenar conversas">
                      {sortOrder === 'recent' ? (
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem 
                      onClick={() => setSortOrder('recent')}
                      className={sortOrder === 'recent' ? 'bg-accent' : ''}
                    >
                      Recentes primeiro
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSortOrder('oldest')}
                      className={sortOrder === 'oldest' ? 'bg-accent' : ''}
                    >
                      Antigos primeiro
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sortOrder === 'recent' ? 'Recentes primeiro' : 'Antigos primeiro'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Status Tabs */}
        <ConversationStatusTabs
          value={statusFilter}
          onChange={setStatusFilter}
          counts={statusCounts}
        />
      </div>

      {/* Inbox Filter (WhatsApp numbers) - Collapsible section */}
      {availableInboxes.length > 0 && (
        <InboxFilter
          inboxes={availableInboxes}
          selectedInboxIds={selectedInboxIds}
          onToggleInbox={handleToggleInbox}
          onSelectAll={handleSelectAllInboxes}
        />
      )}

      {/* Assignment Filter Tabs */}
      <div className="p-2 border-b border-border bg-card">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as AssignmentFilter)}>
          <TabsList className="w-full bg-muted relative z-10 h-8">
            <TabsTrigger value="novos" className="flex-1 text-xs h-7">Novos</TabsTrigger>
            <TabsTrigger value="meus" className="flex-1 text-xs h-7">Meus</TabsTrigger>
            <TabsTrigger value="outros" className="flex-1 text-xs h-7">Outros</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Selected Labels Pills */}
        {selectedLabelIds.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Filtros de etiquetas ativos">
            {selectedLabelIds.slice(0, 3).map((labelId) => {
              const label = allLabels?.find((l) => l.id === labelId);
              if (!label) return null;
              return (
                <button
                  key={labelId}
                  className="inline-flex items-center text-2xs px-1.5 py-0 gap-0.5 cursor-pointer border-0 h-5 rounded-full focusable"
                  style={{
                    backgroundColor: label.color,
                    color: 'white',
                  }}
                  onClick={() => toggleLabelFilter(labelId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleLabelFilter(labelId);
                    }
                  }}
                  aria-label={`Remover filtro ${label.name}`}
                >
                  {label.name}
                  <X className="w-2.5 h-2.5" aria-hidden="true" />
                </button>
              );
            })}
            {selectedLabelIds.length > 3 && (
              <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-5">
                +{selectedLabelIds.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-hidden">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
              <AlertCircle className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              Erro ao carregar conversas
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Não foi possível carregar as conversas. Verifique sua conexão e tente novamente.
            </p>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Tentar novamente
              </Button>
            )}
          </div>
        ) : isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-12 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="flex gap-1.5">
                    <div className="h-5 w-16 bg-muted rounded-full" />
                    <div className="h-5 w-14 bg-muted rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !isUserAuthenticated && (filter === 'meus' || filter === 'outros') ? (
          <div className="p-4">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Você precisa estar autenticado para ver suas conversas.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                <MessageSquare className="w-8 h-8" aria-hidden="true" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                Sessão não identificada
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Faça login para acessar suas conversas atribuídas.
              </p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-primary">
              <MessageSquare className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {searchQuery ? 'Nenhum resultado' : 'Nenhuma conversa'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {searchQuery 
                ? `Nenhuma conversa encontrada para "${searchQuery}". Tente outros termos.`
                : 'Clique em "+ Nova conversa" para iniciar um atendimento'
              }
            </p>
            {!searchQuery && (
              <Button size="sm" onClick={onNewConversation}>
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                Nova conversa
              </Button>
            )}
          </div>
        ) : (
          <VirtualizedConversationList
            conversations={filteredConversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={onSelectConversation}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            isLoadingMore={isLoadingMore}
          />
        )}
      </div>
    </div>
  );
}

// Virtualized conversation list component for performance
function VirtualizedConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  conversations: ConversationData[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CONVERSATION_ITEM_HEIGHT,
    overscan: 5,
  });

  // Load more when reaching the bottom of the list
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  
  React.useEffect(() => {
    if (!lastItem) return;
    
    // If we're within 5 items of the end, load more
    if (
      lastItem.index >= conversations.length - 5 &&
      hasMore &&
      !isLoadingMore &&
      onLoadMore
    ) {
      onLoadMore();
    }
  }, [lastItem?.index, conversations.length, hasMore, isLoadingMore, onLoadMore]);

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      role="list"
      aria-label="Lista de conversas"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const conversation = conversations[virtualItem.index];
          return (
            <div
              key={conversation.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="border-b border-border"
            >
              <MemoizedConversationItem
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onSelect={onSelectConversation}
              />
            </div>
          );
        })}
      </div>
      
      {/* Loading more indicator at bottom */}
      {isLoadingMore && (
        <div className="flex justify-center py-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Carregando mais conversas...</span>
          </div>
        </div>
      )}
    </div>
  );
}
