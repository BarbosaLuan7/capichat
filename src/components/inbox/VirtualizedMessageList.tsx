import React, { useRef, useMemo, useEffect, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { Loader2, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageBubble } from '@/components/inbox/MessageBubble';
import { InlineNoteMessage } from '@/components/inbox/InlineNoteMessage';
import { DateSeparator } from '@/components/inbox/DateSeparator';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import type { Database, Json } from '@/integrations/supabase/types';

type MessageRow = Database['public']['Tables']['messages']['Row'];

// Extended message type that accepts both database Json and typed quoted_message
type Message = Omit<MessageRow, 'quoted_message'> & {
  isOptimistic?: boolean;
  errorMessage?: string;
  is_deleted_locally?: boolean | null;
  quoted_message?: Json | {
    id: string;
    body: string;
    from: string;
    type?: string;
  } | null;
};

type InternalNote = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  conversation_id: string;
  profiles: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
};

// Flattened item types for virtualization
type VirtualItemDateSeparator = { type: 'date-separator'; date: Date; id: string };
type VirtualItemUnreadSeparator = { type: 'unread-separator'; id: string };
type VirtualItemMessage = { 
  type: 'message'; 
  message: Message; 
  showAvatar: boolean; 
  id: string;
  messageIndex: number;
};
type VirtualItemNote = { type: 'note'; note: InternalNote; id: string };

type VirtualItem = VirtualItemDateSeparator | VirtualItemUnreadSeparator | VirtualItemMessage | VirtualItemNote;

interface VirtualizedMessageListProps {
  messages: Message[];
  internalNotes: InternalNote[] | undefined;
  initialUnreadCount: number;
  lead: {
    id: string;
    name: string;
    phone: string;
    avatar_url?: string | null;
    benefit_type?: string | null;
  };
  agentName?: string;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
  selectionMode: boolean;
  selectedMessages: string[];
  onToggleSelect: (messageId: string) => void;
  isLoadingMessages: boolean;
  isLoadingMoreMessages?: boolean;
  hasMoreMessages?: boolean;
  onLoadMoreMessages?: () => void;
  getSignedUrl: (url: string | null | undefined) => string | null;
  onTemplateSelect: (content: string) => void;
  // Callback when initial scroll is done
  onInitialScrollDone?: () => void;
  // Upload progress for showing indicator
  uploadProgress?: { uploading: boolean; progress: number };
}

export interface VirtualizedMessageListRef {
  scrollToBottom: () => void;
}

// Estimate item heights for virtualization
function getEstimatedSize(item: VirtualItem): number {
  switch (item.type) {
    case 'date-separator':
      return 48;
    case 'unread-separator':
      return 56;
    case 'note':
      return 72;
    case 'message': {
      const msg = item.message;
      if (msg.type === 'image') return 300;
      if (msg.type === 'video') return 300;
      if (msg.type === 'audio') return 120;
      if (msg.type === 'document') return 100;
      // Text - estimate based on length
      const textLength = msg.content?.length || 0;
      if (textLength < 50) return 72;
      if (textLength < 150) return 96;
      if (textLength < 300) return 130;
      return 170;
    }
    default:
      return 80;
  }
}

// Flatten messages and notes into virtualized items
function flattenItems(
  messages: Message[],
  notes: InternalNote[] | undefined,
  initialUnreadCount: number
): VirtualItem[] {
  if (!messages.length) return [];

  // Combine messages and notes
  type CombinedItem = 
    | (Message & { itemType: 'message' })
    | (InternalNote & { itemType: 'note' });

  const messageItems: CombinedItem[] = messages
    .filter(m => !m.is_deleted_locally)
    .map(m => ({ ...m, itemType: 'message' as const }));

  const noteItems: CombinedItem[] = (notes || []).map(n => ({ ...n, itemType: 'note' as const }));

  const combined = [...messageItems, ...noteItems].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const items: VirtualItem[] = [];
  let currentDateKey: string | null = null;
  let prevSenderType: string | null = null;
  let messageIndex = 0;

  // Calculate first unread index
  const totalMessages = messages.filter(m => !m.is_deleted_locally).length;
  const firstUnreadMessageIndex = initialUnreadCount > 0 ? totalMessages - initialUnreadCount : -1;

  combined.forEach((item) => {
    const itemDate = new Date(item.created_at);
    const dateKey = format(itemDate, 'yyyy-MM-dd');

    // Add date separator if new day
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      items.push({
        type: 'date-separator',
        date: itemDate,
        id: `date-${dateKey}`,
      });
    }

    if (item.itemType === 'note') {
      items.push({
        type: 'note',
        note: item as InternalNote,
        id: `note-${item.id}`,
      });
      prevSenderType = null; // Reset for avatar logic
    } else {
      const message = item as Message;
      const currentMessageIndex = messageIndex;
      messageIndex++;

      // Add unread separator before first unread message
      if (currentMessageIndex === firstUnreadMessageIndex) {
        items.push({
          type: 'unread-separator',
          id: 'unread-separator',
        });
      }

      // Determine if should show avatar
      const showAvatar = prevSenderType !== message.sender_type;
      prevSenderType = message.sender_type;

      items.push({
        type: 'message',
        message,
        showAvatar,
        id: message.id,
        messageIndex: currentMessageIndex,
      });
    }
  });

  return items;
}

const VirtualizedMessageListComponent = forwardRef<VirtualizedMessageListRef, VirtualizedMessageListProps>(
  function VirtualizedMessageListComponent({
    messages,
    internalNotes,
    initialUnreadCount,
    lead,
    agentName,
    onReply,
    onRetry,
    selectionMode,
    selectedMessages,
    onToggleSelect,
    isLoadingMessages,
    isLoadingMoreMessages,
    hasMoreMessages,
    onLoadMoreMessages,
    getSignedUrl,
    onTemplateSelect,
    onInitialScrollDone,
    uploadProgress,
  }, ref) {
  const parentRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const prevItemCountRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  // Flatten items for virtualization
  const flatItems = useMemo(
    () => flattenItems(messages, internalNotes, initialUnreadCount),
    [messages, internalNotes, initialUnreadCount]
  );

  // Find unread separator index for initial scroll
  const unreadSeparatorIndex = useMemo(() => {
    return flatItems.findIndex(item => item.type === 'unread-separator');
  }, [flatItems]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => getEstimatedSize(flatItems[index]),
    overscan: 8,
    // Measure elements after render for accurate heights
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Expose scrollToBottom method via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (flatItems.length > 0) {
        virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' });
      }
    },
  }), [flatItems.length, virtualizer]);

  // Handle initial scroll positioning
  useEffect(() => {
    if (initialScrollDoneRef.current || flatItems.length === 0 || isLoadingMessages) return;

    const scrollToPosition = () => {
      if (unreadSeparatorIndex >= 0) {
        // Scroll to first unread message
        virtualizer.scrollToIndex(unreadSeparatorIndex, { align: 'start' });
      } else {
        // Scroll to bottom for read conversations
        virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' });
      }
      initialScrollDoneRef.current = true;
      onInitialScrollDone?.();
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToPosition();
      // Double-check scroll position after a short delay
      setTimeout(scrollToPosition, 100);
    });
  }, [flatItems.length, unreadSeparatorIndex, isLoadingMessages, virtualizer, onInitialScrollDone]);

  // Handle loading more when scrolling near top
  const handleScroll = useCallback(() => {
    if (!parentRef.current || isLoadingMoreRef.current) return;

    const { scrollTop } = parentRef.current;

    // Load more when within 200px of top
    if (scrollTop < 200 && hasMoreMessages && onLoadMoreMessages && !isLoadingMoreMessages) {
      isLoadingMoreRef.current = true;
      
      // Store current scroll position info for restoration
      const currentScrollHeight = parentRef.current.scrollHeight;
      
      onLoadMoreMessages();

      // After loading, restore scroll position
      requestAnimationFrame(() => {
        if (parentRef.current) {
          const newScrollHeight = parentRef.current.scrollHeight;
          const scrollDelta = newScrollHeight - currentScrollHeight;
          if (scrollDelta > 0) {
            parentRef.current.scrollTop = scrollTop + scrollDelta;
          }
        }
        isLoadingMoreRef.current = false;
      });
    }
  }, [hasMoreMessages, onLoadMoreMessages, isLoadingMoreMessages]);

  // Reset loading ref when isLoadingMoreMessages changes
  useEffect(() => {
    if (!isLoadingMoreMessages) {
      isLoadingMoreRef.current = false;
    }
  }, [isLoadingMoreMessages]);

  // Handle scroll position when new items are prepended (loading more)
  useEffect(() => {
    const prevCount = prevItemCountRef.current;
    const currentCount = flatItems.length;

    if (prevCount > 0 && currentCount > prevCount && parentRef.current) {
      // Items were prepended - maintain scroll position
      const addedCount = currentCount - prevCount;
      const addedHeight = flatItems
        .slice(0, addedCount)
        .reduce((sum, item) => sum + getEstimatedSize(item), 0);

      if (addedHeight > 0) {
        parentRef.current.scrollTop += addedHeight;
      }
    }

    prevItemCountRef.current = currentCount;
  }, [flatItems]);

  // Render individual virtual item
  const renderItem = useCallback((item: VirtualItem) => {
    switch (item.type) {
      case 'date-separator':
        return <DateSeparator date={item.date} />;

      case 'unread-separator':
        return (
          <div className="flex items-center gap-3 py-3">
            <div className="flex-1 h-px bg-primary/40" />
            <span className="text-xs font-medium text-primary px-2">
              Mensagens não lidas
            </span>
            <div className="flex-1 h-px bg-primary/40" />
          </div>
        );

      case 'note':
        return <InlineNoteMessage note={item.note} />;

      case 'message':
        // Cast to MessageBubble's expected Message type - both have same structure
        return (
          <MessageBubble
            message={item.message as Parameters<typeof MessageBubble>[0]['message']}
            isAgent={item.message.sender_type === 'agent'}
            showAvatar={item.showAvatar}
            leadName={lead.name}
            leadAvatarUrl={lead.avatar_url}
            agentName={agentName}
            onReply={onReply as (message: Parameters<typeof MessageBubble>[0]['message']) => void}
            onRetry={onRetry as (message: Parameters<typeof MessageBubble>[0]['message']) => void}
            resolvedMediaUrl={item.message.media_url ? getSignedUrl(item.message.media_url) : undefined}
            selectionMode={selectionMode}
            isSelected={selectedMessages.includes(item.message.id)}
            onToggleSelect={onToggleSelect}
          />
        );

      default:
        return null;
    }
  }, [lead, agentName, onReply, onRetry, getSignedUrl, selectionMode, selectedMessages, onToggleSelect]);

  // Loading state
  if (isLoadingMessages) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-3xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn("flex gap-2 animate-pulse", i % 2 === 0 && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
              <div className={cn(
                "rounded-2xl p-4 max-w-[70%] space-y-2",
                i % 2 === 0 ? "bg-primary/20" : "bg-card"
              )}>
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
                <div className="h-2 w-12 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (flatItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-base font-medium text-foreground mb-1">
          Nenhuma mensagem ainda
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-4">
          Envie a primeira mensagem para iniciar a conversa
        </p>
        <TemplateSelector
          onSelectTemplate={onTemplateSelect}
          leadName={lead.name}
          leadPhone={lead.phone}
          leadBenefitType={lead.benefit_type || undefined}
          agentName={agentName}
          triggerElement={
            <Button variant="outline" size="sm" className="gap-2">
              <Zap className="w-4 h-4" />
              Usar template de boas-vindas
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto p-4 bg-muted/30"
      onScroll={handleScroll}
    >
      <div
        className="relative max-w-3xl mx-auto"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {/* Loading more indicator at top */}
        {isLoadingMoreMessages && (
          <div className="absolute top-0 left-0 right-0 flex justify-center py-4 z-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Carregando mensagens anteriores...</span>
            </div>
          </div>
        )}

        {/* Indicator when there are no more old messages */}
        {!isLoadingMoreMessages && !hasMoreMessages && messages.length > 10 && (
          <div 
            className="absolute left-0 right-0 flex justify-center py-3"
            style={{ top: 0 }}
          >
            <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
              Início da conversa
            </span>
          </div>
        )}

        {/* Virtual items */}
        {virtualItems.map((virtualRow) => {
          const item = flatItems[virtualRow.index];
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 right-0 overflow-visible"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="py-1 overflow-visible">
                {renderItem(item)}
              </div>
            </div>
          );
        })}

        {/* Upload progress indicator */}
        {uploadProgress?.uploading && (
          <div 
            className="absolute left-0 right-0"
            style={{ transform: `translateY(${virtualizer.getTotalSize()}px)` }}
          >
            <div className="flex gap-2 flex-row-reverse animate-pulse py-2">
              <div className="w-8 h-8 rounded-full bg-primary/30 shrink-0" />
              <div className="rounded-2xl rounded-tr-sm bg-primary/40 p-4 max-w-[70%] space-y-2">
                <div className="h-3 w-32 bg-primary/30 rounded" />
                <div className="flex items-center gap-1 justify-end">
                  <Loader2 className="w-3 h-3 animate-spin text-primary-foreground/50" />
                  <span className="text-xs text-primary-foreground/50">Enviando arquivo...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

VirtualizedMessageListComponent.displayName = 'VirtualizedMessageList';

export const VirtualizedMessageList = memo(VirtualizedMessageListComponent);
