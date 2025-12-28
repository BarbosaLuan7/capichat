import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

// Hooks
import {
  useConversation,
  useSendMessage,
  useMarkConversationAsRead,
  useToggleConversationFavorite,
  useUpdateConversationAssignee,
  useUpdateConversationStatus,
} from '@/hooks/useConversations';
import { useConversationsInfinite } from '@/hooks/useConversationsInfinite';
import { useMessagesInfinite } from '@/hooks/useMessagesInfinite';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useLeadLabels } from '@/hooks/useLabels';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInboxRealtime } from '@/hooks/useInboxRealtime';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useUIStore } from '@/store/uiStore';

// Components - Lazy loaded for better performance
import { ConversationList } from '@/components/inbox/ConversationList';
import { LeadDetailsPanelSkeleton, ChatAreaSkeleton } from '@/components/ui/skeleton';

// Lazy load heavy components
const ChatArea = lazy(() => import('@/components/inbox/ChatArea').then(m => ({ default: m.ChatArea })));
const LeadDetailsPanel = lazy(() => import('@/components/inbox/LeadDetailsPanel').then(m => ({ default: m.LeadDetailsPanel })));
const NewConversationModal = lazy(() => import('@/components/inbox/NewConversationModal').then(m => ({ default: m.NewConversationModal })));

import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

const LEAD_PANEL_STORAGE_KEY = 'inbox-show-lead-panel-v2';

const Inbox = () => {
  const { user, authUser } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSidebarCollapsed } = useUIStore();

  // Orchestration state
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showLeadPanel, setShowLeadPanel] = useState(() => {
    const saved = localStorage.getItem(LEAD_PANEL_STORAGE_KEY);
    return saved === 'true';
  });
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const userClickedConversationRef = useRef(false);

  // Data hooks - usando paginação infinita
  const {
    conversations,
    isLoading: loadingConversations,
    isError: conversationsError,
    hasNextPage: hasMoreConversations,
    fetchNextPage: fetchMoreConversations,
    isFetchingNextPage: loadingMoreConversations,
    addConversationOptimistically,
    updateConversationOptimistically,
  } = useConversationsInfinite();

  const { data: selectedConversation } = useConversation(selectedConversationId || undefined);

  const {
    messages,
    isLoading: loadingMessages,
    hasNextPage: hasMoreMessages,
    fetchNextPage: fetchMoreMessages,
    isFetchingNextPage: loadingMoreMessages,
    addMessageOptimistically,
    updateMessageOptimistically,
  } = useMessagesInfinite(selectedConversationId || undefined);

  const { data: leadData, refetch: refetchLead, isLoading: loadingLead } = useLead(selectedConversation?.lead_id || undefined);
  const { data: leadLabels } = useLeadLabels(selectedConversation?.lead_id || undefined);

  // Mutations
  const sendMessage = useSendMessage();
  const markAsRead = useMarkConversationAsRead();
  const toggleFavorite = useToggleConversationFavorite();
  const updateAssignee = useUpdateConversationAssignee();
  const updateLead = useUpdateLead();
  const updateConversationStatus = useUpdateConversationStatus();

  // Notification sound hook
  const { notify } = useNotificationSound();

  // Unified realtime subscription with optimistic update functions
  useInboxRealtime({
    selectedConversationId,
    onNewIncomingMessage: (message, leadName) => {
      // Play sound and show toast for messages from non-selected conversations
      notify(message.content, leadName);
      logger.log('[Inbox] New incoming message:', message.id);
    },
    addMessageOptimistically,
    updateMessageOptimistically,
    addConversationOptimistically,
    updateConversationOptimistically,
  });

  // Persist lead panel toggle
  useEffect(() => {
    localStorage.setItem(LEAD_PANEL_STORAGE_KEY, String(showLeadPanel));
  }, [showLeadPanel]);

  // Handle conversation from URL query param
  useEffect(() => {
    const conversationFromUrl = searchParams.get('conversation');
    if (conversationFromUrl && !selectedConversationId) {
      setSelectedConversationId(conversationFromUrl);
      userClickedConversationRef.current = true;
      // Clear query param - create new URLSearchParams to avoid mutation
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('conversation');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, selectedConversationId, setSearchParams]);

  // Mark as read when user explicitly clicks a conversation
  useEffect(() => {
    if (
      selectedConversationId &&
      userClickedConversationRef.current &&
      selectedConversation?.unread_count &&
      selectedConversation.unread_count > 0 &&
      document.visibilityState === 'visible'
    ) {
      markAsRead.mutate(selectedConversationId);
    }
    userClickedConversationRef.current = false;
  }, [selectedConversationId, selectedConversation?.unread_count, markAsRead]);

  // Prepare lead with labels - memoized to prevent re-renders
  const leadWithLabels = useMemo(() => {
    if (!leadData) return null;
    return {
      ...leadData,
      labels: leadLabels?.map((ll: any) => ll.labels) || [],
    };
  }, [leadData, leadLabels]);

  // Callbacks for child components
  const handleSelectConversation = useCallback((id: string) => {
    userClickedConversationRef.current = true;
    setSelectedConversationId(id);
    // Auto-colapsar sidebar para focar na conversa
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  const handleSendMessage = useCallback(async (content: string, type: string, mediaUrl?: string | null) => {
    if (!selectedConversationId || !user) return;

    await sendMessage.mutateAsync({
      conversation_id: selectedConversationId,
      sender_id: user.id,
      sender_type: 'agent',
      content,
      type: type as any,
      media_url: mediaUrl,
    });
  }, [selectedConversationId, user, sendMessage]);

  const handleStatusChange = useCallback((status: ConversationStatus) => {
    if (!selectedConversationId) return;
    updateConversationStatus.mutate(
      { conversationId: selectedConversationId, status },
      {
        onSuccess: () => {
          const statusLabels = { open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida' };
          toast.success(`Conversa marcada como ${statusLabels[status]}`);
        },
        onError: () => {
          toast.error('Erro ao atualizar status');
        },
      }
    );
  }, [selectedConversationId, updateConversationStatus]);

  const handleToggleFavorite = useCallback(() => {
    if (!selectedConversationId || !selectedConversation) return;
    toggleFavorite.mutate({
      conversationId: selectedConversationId,
      isFavorite: !(selectedConversation as any).is_favorite,
    });
  }, [selectedConversationId, selectedConversation, toggleFavorite]);

  const handleTransfer = useCallback(async (userId: string) => {
    if (!selectedConversationId || !leadData) return;

    try {
      await updateAssignee.mutateAsync({
        conversationId: selectedConversationId,
        assignedTo: userId,
      });
      await updateLead.mutateAsync({
        id: leadData.id,
        assigned_to: userId,
      });
      toast.success('Lead transferido com sucesso');
    } catch (error) {
      toast.error('Erro ao transferir lead');
    }
  }, [selectedConversationId, leadData, updateAssignee, updateLead]);

  // Mobile visibility logic
  const showConversationList = !isMobile || !selectedConversationId;
  const showChatArea = !isMobile || selectedConversationId;

  return (
    <div className={cn(
      "h-[calc(100vh-4rem)] flex min-w-0 overflow-hidden relative",
      isMobile && "h-[calc(100vh-4rem-3.5rem)]"
    )}>
      {/* Conversation List */}
      {showConversationList && (
        <div className={cn(
          "w-64 md:w-72 xl:w-80 border-r border-border flex flex-col bg-card shrink-0 min-w-0",
          isMobile && "w-full border-r-0"
        )}>
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

      {/* Chat Area - Lazy loaded */}
      {showChatArea && (
        <Suspense fallback={<ChatAreaSkeleton />}>
          <ChatArea
            conversation={selectedConversation ? {
              id: selectedConversation.id,
              status: selectedConversation.status,
              is_favorite: (selectedConversation as any).is_favorite,
              lead_id: selectedConversation.lead_id,
            } : null}
            lead={leadWithLabels}
            messages={messages}
            isLoadingMessages={loadingMessages}
            onSendMessage={handleSendMessage}
            onStatusChange={handleStatusChange}
            onToggleFavorite={handleToggleFavorite}
            isUpdatingStatus={updateConversationStatus.isPending}
            showLeadPanel={showLeadPanel}
            onToggleLeadPanel={() => setShowLeadPanel(!showLeadPanel)}
            agentName={authUser?.name}
            onBack={() => setSelectedConversationId(null)}
            hasMoreMessages={hasMoreMessages}
            onLoadMoreMessages={fetchMoreMessages}
            isLoadingMoreMessages={loadingMoreMessages}
          />
        </Suspense>
      )}

      {/* Lead Panel - Lazy loaded */}
      <AnimatePresence>
        {selectedConversation && showLeadPanel && (
          isMobile ? (
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
                className="absolute right-0 top-0 h-full w-[360px] max-w-[92vw] border-l border-border bg-card shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {loadingLead ? (
                  <LeadDetailsPanelSkeleton />
                ) : leadWithLabels ? (
                  <Suspense fallback={<LeadDetailsPanelSkeleton />}>
                    <LeadDetailsPanel
                      lead={leadWithLabels}
                      conversationId={selectedConversation.id}
                      messages={messages}
                      isFavorite={(selectedConversation as any).is_favorite}
                      onToggleFavorite={handleToggleFavorite}
                      onTransfer={handleTransfer}
                      onLabelsUpdate={() => refetchLead()}
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
              className="w-[300px] xl:w-[340px] max-w-[340px] border-l border-border bg-card overflow-hidden shrink-0"
            >
              {loadingLead ? (
                <LeadDetailsPanelSkeleton />
              ) : leadWithLabels ? (
                <Suspense fallback={<LeadDetailsPanelSkeleton />}>
                  <LeadDetailsPanel
                    lead={leadWithLabels}
                    conversationId={selectedConversation.id}
                    messages={messages}
                    isFavorite={(selectedConversation as any).is_favorite}
                    onToggleFavorite={handleToggleFavorite}
                    onTransfer={handleTransfer}
                    onLabelsUpdate={() => refetchLead()}
                  />
                </Suspense>
              ) : (
                <LeadDetailsPanelSkeleton />
              )}
            </motion.aside>
          )
        )}
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
  );
};

export default Inbox;
