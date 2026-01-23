import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// Context
import { InboxProvider, useInbox } from '@/contexts/InboxContext';

// Hooks
import { useConversationsInfinite } from '@/hooks/useConversationsInfinite';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInboxRealtime } from '@/hooks/useInboxRealtime';
import { useNotificationSound } from '@/hooks/useNotificationSound';

// Components - Lazy loaded for better performance
import { ConversationList } from '@/components/inbox/ConversationList';
import { LeadDetailsPanelSkeleton, ChatAreaSkeleton } from '@/components/ui/skeleton';

// Lazy load heavy components
const ChatArea = lazy(() =>
  import('@/components/inbox/ChatArea').then((m) => ({ default: m.ChatArea }))
);
const LeadDetailsPanel = lazy(() =>
  import('@/components/inbox/LeadDetailsPanel').then((m) => ({ default: m.LeadDetailsPanel }))
);
const NewConversationModal = lazy(() =>
  import('@/components/inbox/NewConversationModal').then((m) => ({
    default: m.NewConversationModal,
  }))
);

// Inner component that uses the context
const InboxContent = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Get state from context
  const {
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
    messages,
    lead,
    isLoadingLead,
    showLeadPanel,
    setShowLeadPanel,
    onToggleFavorite,
    onTransfer,
    onMarkAsRead,
    addMessageOptimistically,
    updateMessageOptimistically,
    userClickedConversationRef,
  } = useInbox();

  // Local state only for this component
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  // Conversation list data (stays here because ConversationList is not using context yet)
  const {
    conversations,
    isLoading: loadingConversations,
    isError: conversationsError,
    hasNextPage: hasMoreConversations,
    fetchNextPage: fetchMoreConversations,
    isFetchingNextPage: loadingMoreConversations,
    addConversationOptimistically: addConvOptimistic,
    updateConversationOptimistically: updateConvOptimistic,
  } = useConversationsInfinite();

  // Notification sound hook
  const { notify } = useNotificationSound();

  // Unified realtime subscription with optimistic update functions
  const { connectionStatus, showDisconnectedBanner, forceReconnect } = useInboxRealtime({
    selectedConversationId,
    onNewIncomingMessage: (message, leadName) => {
      notify(message.content, leadName);
      logger.log('[Inbox] New incoming message:', message.id);
    },
    addMessageOptimistically,
    updateMessageOptimistically,
    addConversationOptimistically: addConvOptimistic,
    updateConversationOptimistically: updateConvOptimistic,
  });

  // Callbacks
  const handleSelectConversation = useCallback(
    (id: string) => {
      userClickedConversationRef.current = true;
      setSelectedConversationId(id);
    },
    [setSelectedConversationId, userClickedConversationRef]
  );

  // Mobile visibility logic
  const showConversationList = !isMobile || !selectedConversationId;
  const showChatArea = !isMobile || selectedConversationId;

  return (
    <div
      className={cn(
        'relative flex h-[calc(100vh-4rem)] min-w-0 select-none flex-col overflow-hidden',
        isMobile && 'h-[calc(100vh-4rem-3.5rem)]'
      )}
    >
      {/* Disconnection Banner - only shows after 3s delay */}
      {showDisconnectedBanner && (
        <div className="flex shrink-0 items-center justify-between border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>Conexao perdida. Tentando reconectar...</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={forceReconnect}
            className="h-7 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Reconectar
          </Button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 overflow-hidden">
        {/* Conversation List */}
        {showConversationList && (
          <div
            className={cn(
              'flex w-64 min-w-0 shrink-0 flex-col border-r border-border bg-card md:w-72 xl:w-80',
              isMobile && 'w-full border-r-0'
            )}
          >
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={() => setShowNewConversationModal(true)}
              isLoading={loadingConversations}
              isError={conversationsError}
              onRetry={() => fetchMoreConversations()}
              userId={user?.id}
              hasMore={hasMoreConversations}
              onLoadMore={fetchMoreConversations}
              isLoadingMore={loadingMoreConversations}
            />
          </div>
        )}

        {/* Chat Area - Lazy loaded, now uses context internally */}
        {showChatArea && (
          <Suspense fallback={<ChatAreaSkeleton />}>
            <ChatArea
              key={selectedConversation?.id}
              onBack={() => setSelectedConversationId(null)}
              onStartTyping={() => {
                // Badge some ao digitar APENAS se ja esta atribuida
                if (
                  selectedConversationId &&
                  selectedConversation?.assigned_to &&
                  selectedConversation?.unread_count &&
                  selectedConversation.unread_count > 0
                ) {
                  onMarkAsRead();
                }
              }}
              onMessageSent={() => {
                // Badge some ao enviar APENAS se NAO estava atribuida
                if (
                  selectedConversationId &&
                  !selectedConversation?.assigned_to &&
                  selectedConversation?.unread_count &&
                  selectedConversation.unread_count > 0
                ) {
                  onMarkAsRead();
                }
              }}
            />
          </Suspense>
        )}

        {/* Lead Panel - Lazy loaded */}
        <AnimatePresence>
          {selectedConversation &&
            showLeadPanel &&
            (isMobile ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-50 bg-background/40 backdrop-blur-sm"
                onClick={() => setShowLeadPanel(false)}
                role="dialog"
                aria-label="Detalhes do lead"
              >
                <motion.aside
                  initial={{ x: 360 }}
                  animate={{ x: 0 }}
                  exit={{ x: 360 }}
                  transition={{ type: 'tween', duration: 0.2 }}
                  className="absolute right-0 top-0 h-full w-[360px] max-w-[92vw] overflow-hidden border-l border-border bg-card shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isLoadingLead ? (
                    <LeadDetailsPanelSkeleton />
                  ) : lead ? (
                    <Suspense fallback={<LeadDetailsPanelSkeleton />}>
                      <LeadDetailsPanel
                        lead={lead}
                        conversationId={selectedConversation.id}
                        messages={messages}
                        isFavorite={selectedConversation.is_favorite ?? false}
                        onToggleFavorite={onToggleFavorite}
                        onTransfer={onTransfer}
                        onLabelsUpdate={() => {}}
                      />
                    </Suspense>
                  ) : (
                    <LeadDetailsPanelSkeleton />
                  )}
                </motion.aside>
              </motion.div>
            ) : (
              <motion.aside
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-[300px] max-w-[340px] shrink-0 overflow-hidden border-l border-border bg-card xl:w-[340px]"
              >
                {isLoadingLead ? (
                  <LeadDetailsPanelSkeleton />
                ) : lead ? (
                  <Suspense fallback={<LeadDetailsPanelSkeleton />}>
                    <LeadDetailsPanel
                      lead={lead}
                      conversationId={selectedConversation.id}
                      messages={messages}
                      isFavorite={selectedConversation.is_favorite ?? false}
                      onToggleFavorite={onToggleFavorite}
                      onTransfer={onTransfer}
                      onLabelsUpdate={() => {}}
                    />
                  </Suspense>
                ) : (
                  <LeadDetailsPanelSkeleton />
                )}
              </motion.aside>
            ))}
        </AnimatePresence>

        {/* New Conversation Modal - Lazy loaded */}
        <Suspense fallback={null}>
          <NewConversationModal
            open={showNewConversationModal}
            onOpenChange={setShowNewConversationModal}
            onConversationCreated={(conversationId) => {
              setSelectedConversationId(conversationId);
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

// Main component wrapped with Provider
const Inbox = () => {
  return (
    <InboxProvider>
      <InboxContent />
    </InboxProvider>
  );
};

export default Inbox;
