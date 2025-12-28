import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

// Hooks
import {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useMarkConversationAsRead,
  useToggleConversationFavorite,
  useUpdateConversationAssignee,
  useToggleMessageStar,
  useUpdateConversationStatus,
} from '@/hooks/useConversations';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useLeadLabels } from '@/hooks/useLabels';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInboxRealtime } from '@/hooks/useInboxRealtime';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useUIStore } from '@/store/uiStore';

// Components
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatArea } from '@/components/inbox/ChatArea';
import { LeadDetailsPanel } from '@/components/inbox/LeadDetailsPanel';
import { NewConversationModal } from '@/components/inbox/NewConversationModal';
import { LeadDetailsPanelSkeleton } from '@/components/ui/skeleton';

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

  // Data hooks
  const { data: conversations, isLoading: loadingConversations, isError: conversationsError, refetch: refetchConversations } = useConversations();
  const { data: selectedConversation } = useConversation(selectedConversationId || undefined);
  const { data: messages, isLoading: loadingMessages } = useMessages(selectedConversationId || undefined);
  const { data: leadData, refetch: refetchLead, isLoading: loadingLead } = useLead(selectedConversation?.lead_id || undefined);
  const { data: leadLabels } = useLeadLabels(selectedConversation?.lead_id || undefined);

  // Mutations
  const sendMessage = useSendMessage();
  const markAsRead = useMarkConversationAsRead();
  const toggleFavorite = useToggleConversationFavorite();
  const updateAssignee = useUpdateConversationAssignee();
  const toggleMessageStar = useToggleMessageStar();
  const updateLead = useUpdateLead();
  const updateConversationStatus = useUpdateConversationStatus();

  // Notification sound hook
  const { notify } = useNotificationSound();

  // Unified realtime subscription
  useInboxRealtime({
    selectedConversationId,
    onNewIncomingMessage: (message, leadName) => {
      // Play sound and show toast for messages from non-selected conversations
      notify(message.content, leadName);
      logger.log('[Inbox] New incoming message:', message.id);
    },
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

  // Prepare lead with labels
  const leadWithLabels = leadData ? {
    ...leadData,
    labels: leadLabels?.map((ll: any) => ll.labels) || [],
  } : null;

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

  const handleToggleMessageStar = useCallback((messageId: string, isStarred: boolean) => {
    toggleMessageStar.mutate({ messageId, isStarred });
  }, [toggleMessageStar]);

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
          "w-72 md:w-80 xl:w-96 border-r border-border flex flex-col bg-card shrink-0 min-w-0",
          isMobile && "w-full border-r-0"
        )}>
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={() => setShowNewConversationModal(true)}
            isLoading={loadingConversations}
            isError={conversationsError}
            onRetry={() => refetchConversations()}
            userId={user?.id}
          />
        </div>
      )}

      {/* Chat Area */}
      {showChatArea && (
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
          onToggleMessageStar={handleToggleMessageStar}
          isUpdatingStatus={updateConversationStatus.isPending}
          showLeadPanel={showLeadPanel}
          onToggleLeadPanel={() => setShowLeadPanel(!showLeadPanel)}
          agentName={authUser?.name}
          onBack={() => setSelectedConversationId(null)}
        />
      )}

      {/* Lead Panel */}
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
                  <LeadDetailsPanel
                    lead={leadWithLabels}
                    conversationId={selectedConversation.id}
                    messages={messages}
                    isFavorite={(selectedConversation as any).is_favorite}
                    onToggleFavorite={handleToggleFavorite}
                    onTransfer={handleTransfer}
                    onLabelsUpdate={() => refetchLead()}
                  />
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
                <LeadDetailsPanel
                  lead={leadWithLabels}
                  conversationId={selectedConversation.id}
                  messages={messages}
                  isFavorite={(selectedConversation as any).is_favorite}
                  onToggleFavorite={handleToggleFavorite}
                  onTransfer={handleTransfer}
                  onLabelsUpdate={() => refetchLead()}
                />
              ) : (
                <LeadDetailsPanelSkeleton />
              )}
            </motion.aside>
          )
        )}
      </AnimatePresence>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversationModal}
        onOpenChange={setShowNewConversationModal}
        onConversationCreated={(conversationId) => {
          setSelectedConversationId(conversationId);
        }}
      />
    </div>
  );
};

export default Inbox;
