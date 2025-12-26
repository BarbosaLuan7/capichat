import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Tag,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  MessageSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ConversationStatusTabs } from '@/components/inbox/ConversationStatusTabs';
import { ConversationItem } from '@/components/inbox/ConversationItem';
import { useDebounce } from '@/hooks/useDebounce';
import { useLabels } from '@/hooks/useLabels';
import type { Database } from '@/integrations/supabase/types';

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
type InboxFilter = 'novos' | 'meus' | 'outros';

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
}

interface ConversationListProps {
  conversations: ConversationData[] | undefined;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isLoading: boolean;
  userId?: string;
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
  userId,
}: ConversationListProps) {
  const [filter, setFilter] = useState<InboxFilter>('meus');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [labelSearchTerm, setLabelSearchTerm] = useState('');

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch labels
  const { data: allLabels } = useLabels();

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = { all: 0, open: 0, pending: 0, resolved: 0 };
    conversations?.forEach((conv) => {
      counts.all++;
      if (conv.status === 'open') counts.open++;
      else if (conv.status === 'pending') counts.pending++;
      else if (conv.status === 'resolved') counts.resolved++;
    });
    return counts;
  }, [conversations]);

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

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations?.filter((conv) => {
      // Filter by status tab
      if (statusFilter !== 'all' && conv.status !== statusFilter) {
        return false;
      }

      // Filter by assignment tab
      let matchesFilter = true;
      if (filter === 'novos') {
        const isRecent = new Date(conv.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
        const hasUnread = (conv.unread_count || 0) > 0;
        matchesFilter = !conv.assigned_to || isRecent || hasUnread;
      } else if (filter === 'meus') {
        matchesFilter = conv.assigned_to === userId;
      } else if (filter === 'outros') {
        matchesFilter = !!conv.assigned_to && conv.assigned_to !== userId;
      }
      
      const matchesSearch = !debouncedSearchQuery || 
        conv.leads?.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        conv.leads?.phone?.includes(debouncedSearchQuery);

      // Filter by labels
      const matchesLabels = selectedLabelIds.length === 0 || 
        selectedLabelIds.some((labelId) => 
          conv.leads?.lead_labels?.some((ll: any) => ll.labels?.id === labelId)
        );

      return matchesFilter && matchesSearch && matchesLabels;
    }) || [];

    // Sort by date
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.last_message_at).getTime();
      const dateB = new Date(b.last_message_at).getTime();
      return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [conversations, statusFilter, filter, userId, debouncedSearchQuery, selectedLabelIds, sortOrder]);

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
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              className="pl-8 h-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 px-2 shrink-0">
                <Tag className="w-3.5 h-3.5" />
                {selectedLabelIds.length > 0 && (
                  <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center">
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
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar etiqueta..."
                    value={labelSearchTerm}
                    onChange={(e) => setLabelSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-sm"
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
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: label.color }}
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

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
                {sortOrder === 'recent' ? (
                  <ArrowDown className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
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
        </div>

        {/* Status Tabs */}
        <ConversationStatusTabs
          value={statusFilter}
          onChange={setStatusFilter}
          counts={statusCounts}
        />

        {/* Assignment Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as InboxFilter)}>
          <TabsList className="w-full bg-muted relative z-10 h-8">
            <TabsTrigger value="novos" className="flex-1 text-xs h-7">Novos</TabsTrigger>
            <TabsTrigger value="meus" className="flex-1 text-xs h-7">Meus</TabsTrigger>
            <TabsTrigger value="outros" className="flex-1 text-xs h-7">Outros</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Selected Labels Pills */}
        {selectedLabelIds.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedLabelIds.slice(0, 3).map((labelId) => {
              const label = allLabels?.find((l) => l.id === labelId);
              if (!label) return null;
              return (
                <Badge
                  key={labelId}
                  className="text-[10px] px-1.5 py-0 gap-0.5 cursor-pointer border-0 h-5"
                  style={{
                    backgroundColor: label.color,
                    color: 'white',
                  }}
                  onClick={() => toggleLabelFilter(labelId)}
                >
                  {label.name}
                  <X className="w-2.5 h-2.5" />
                </Badge>
              );
            })}
            {selectedLabelIds.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                +{selectedLabelIds.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 overflow-hidden">
        {isLoading ? (
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
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-primary">
              <MessageSquare className="w-8 h-8" />
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
                <Plus className="w-4 h-4 mr-1" />
                Nova conversa
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation) => (
              <MemoizedConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onSelect={onSelectConversation}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
