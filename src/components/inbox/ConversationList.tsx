import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  AlertCircle,
  Clock,
  Inbox,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// ConversationStatusTabs removed - using simplified tabs now
import { ConversationItem } from '@/components/inbox/ConversationItem';
import { ConversationFiltersPopover } from '@/components/inbox/ConversationFiltersPopover';
import { ActiveFilterChips } from '@/components/inbox/ActiveFilterChips';
import { useConversationFilters } from '@/hooks/useConversationFilters';
import { useDebounce } from '@/hooks/useDebounce';
import { useWhatsAppConfigs } from '@/hooks/useWhatsAppConfig';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

const CONVERSATION_ITEM_HEIGHT = 88; // Approximate height of ConversationItem in px

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
MemoizedConversationItem.displayName = 'MemoizedConversationItem';

type ConversationStatus = Database['public']['Enums']['conversation_status'];
// New simplified filter type: pendentes (unread), todos (not resolved), concluidos (resolved)
type MainFilter = 'pendentes' | 'todos' | 'concluidos';

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
  // New simplified filter: defaults to 'todos' (all non-resolved)
  const [mainFilter, setMainFilter] = useState<MainFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'unread' | 'recent' | 'oldest'>('unread');
  
  // Get filters from global store
  const { filters } = useConversationFilters();
  
  // Ref for virtual list container
  const parentRef = useRef<HTMLDivElement>(null);

  // Track if user is authenticated
  const isUserAuthenticated = Boolean(userId);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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

  // Filter conversations by inbox (WhatsApp number) first
  // Now using EXCLUSION logic: empty excludedInboxIds = show all
  const inboxFilteredConversations = useMemo(() => {
    // If no exclusions, show all conversations
    if (filters.excludedInboxIds.length === 0) {
      return conversations || [];
    }
    // Filter OUT the excluded inboxes
    return (conversations || []).filter((conv) =>
      !conv.whatsapp_config?.id || !filters.excludedInboxIds.includes(conv.whatsapp_config.id)
    );
  }, [conversations, filters.excludedInboxIds]);

  // Filter by labels from global store
  const labelFilteredConversations = useMemo(() => {
    if (filters.labelIds.length === 0) {
      return inboxFilteredConversations;
    }
    return inboxFilteredConversations.filter((conv) =>
      filters.labelIds.some((labelId) =>
        conv.leads?.lead_labels?.some((ll: any) => ll.labels?.id === labelId)
      )
    );
  }, [inboxFilteredConversations, filters.labelIds]);

  // Filter by user assignment from global store
  const userFilteredConversations = useMemo(() => {
    if (filters.userIds.length === 0) {
      return labelFilteredConversations;
    }
    
    const includeUnassigned = filters.userIds.includes('unassigned');
    const specificUserIds = filters.userIds.filter(id => id !== 'unassigned');
    
    return labelFilteredConversations.filter((conv) => {
      if (!conv.assigned_to) {
        return includeUnassigned;
      }
      return specificUserIds.includes(conv.assigned_to);
    });
  }, [labelFilteredConversations, filters.userIds]);

  // Filter by tenant from global store
  const tenantFilteredConversations = useMemo(() => {
    if (filters.tenantIds.length === 0) {
      return userFilteredConversations;
    }
    return userFilteredConversations.filter((conv) =>
      conv.whatsapp_config?.tenant_id && filters.tenantIds.includes(conv.whatsapp_config.tenant_id)
    );
  }, [userFilteredConversations, filters.tenantIds]);

  // Base filtered conversations (after all filters except main tab)
  const baseFilteredConversations = tenantFilteredConversations;

  // Clear search handler
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Calculate counts for new simplified tabs
  const tabCounts = useMemo(() => {
    let pendentes = 0;
    let todos = 0;
    let concluidos = 0;
    
    baseFilteredConversations.forEach((conv) => {
      // Pendentes = tem mensagens não lidas
      if (conv.unread_count > 0) {
        pendentes++;
      }
      
      // Todos = não está resolvido (inclui pendentes também)
      if (conv.status !== 'resolved') {
        todos++;
      }
      
      // Concluídos = status resolved
      if (conv.status === 'resolved') {
        concluidos++;
      }
    });
    
    return { pendentes, todos, concluidos };
  }, [baseFilteredConversations]);

  // Filter and sort conversations based on new simplified tabs
  const filteredConversations = useMemo(() => {
    let filtered = baseFilteredConversations.filter((conv) => {
      // Filter by main tab
      if (mainFilter === 'pendentes') {
        // Pendentes = tem mensagens não lidas
        if (conv.unread_count === 0) return false;
      } else if (mainFilter === 'todos') {
        // Todos = não está resolvido
        if (conv.status === 'resolved') return false;
      } else if (mainFilter === 'concluidos') {
        // Concluídos = resolvido
        if (conv.status !== 'resolved') return false;
      }
      
      // Search filter
      const searchLower = debouncedSearchQuery.toLowerCase();
      const matchesSearch = !debouncedSearchQuery || 
        conv.leads?.name?.toLowerCase().includes(searchLower) ||
        conv.leads?.phone?.includes(debouncedSearchQuery) ||
        conv.leads?.whatsapp_name?.toLowerCase().includes(searchLower);

      return matchesSearch;
    });

    // Sort based on selected order
    filtered = filtered.sort((a, b) => {
      if (sortOrder === 'unread') {
        // Não lidos primeiro, depois por data recente
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        // Se ambos têm ou não têm não lidos, ordenar por data recente
        const dateA = new Date(a.last_message_at).getTime();
        const dateB = new Date(b.last_message_at).getTime();
        return dateB - dateA;
      }
      const dateA = new Date(a.last_message_at).getTime();
      const dateB = new Date(b.last_message_at).getTime();
      return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [baseFilteredConversations, mainFilter, debouncedSearchQuery, sortOrder]);

  return (
    <div className="flex flex-col h-full select-none">
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
        {/* Search + Filters + Sort in one row */}
        <div className="flex items-center gap-2">
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

          {/* Filters Popover - NEW */}
          <ConversationFiltersPopover availableInboxes={availableInboxes} />

          {/* Sort Dropdown */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" aria-label="Ordenar conversas">
                      {sortOrder === 'unread' ? (
                        <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : sortOrder === 'recent' ? (
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem 
                      onClick={() => setSortOrder('unread')}
                      className={sortOrder === 'unread' ? 'bg-accent' : ''}
                    >
                      Não lidos primeiro
                    </DropdownMenuItem>
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
                {sortOrder === 'unread' ? 'Não lidos primeiro' : sortOrder === 'recent' ? 'Recentes primeiro' : 'Antigos primeiro'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Active Filter Chips - NEW */}
        <ActiveFilterChips availableInboxes={availableInboxes} />

        {/* Main Filter Tabs - Simplified with Icons */}
        <TooltipProvider delayDuration={300}>
          <Tabs value={mainFilter} onValueChange={(v) => setMainFilter(v as MainFilter)}>
            <TabsList className="grid grid-cols-3 w-full bg-muted h-auto p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger 
                    value="pendentes" 
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium",
                      tabCounts.pendentes > 0 && "data-[state=inactive]:text-destructive"
                    )}
                  >
                    <Clock className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      tabCounts.pendentes > 0 && "text-destructive"
                    )} />
                    <span className={cn(
                      "font-semibold tabular-nums",
                      tabCounts.pendentes > 0 ? "text-destructive" : ""
                    )}>
                      {tabCounts.pendentes}
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Pendentes (não lidas)
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger 
                    value="todos" 
                    className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium"
                  >
                    <Inbox className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold tabular-nums">
                      {tabCounts.todos}
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Todos (não resolvidos)
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger 
                    value="concluidos" 
                    className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold tabular-nums">
                      {tabCounts.concluidos}
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Concluídos (resolvidos)
                </TooltipContent>
              </Tooltip>
            </TabsList>
          </Tabs>
        </TooltipProvider>
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
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-muted rounded-full" />
                    <div className="h-5 w-14 bg-muted rounded-full" />
                  </div>
                </div>
              </div>
            ))}
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
      style={{ willChange: 'scroll-position' }}
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
                willChange: 'transform',
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
