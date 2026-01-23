import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { getErrorWithFallback } from '@/lib/errorMessages';

// Hooks
import {
  useConversation,
  useSendMessage,
  useMarkConversationAsRead,
  useToggleConversationFavorite,
  useUpdateConversationAssignee,
  useUpdateConversationStatus,
} from '@/hooks/useConversations';
import { useMessagesInfinite } from '@/hooks/useMessagesInfinite';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useLeadLabels } from '@/hooks/useLabels';
import { useAuth } from '@/hooks/useAuth';

import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];
type Message = Database['public']['Tables']['messages']['Row'];

// Types
export interface LeadWithLabels {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  temperature?: string;
  avatar_url?: string | null;
  whatsapp_name?: string | null;
  benefit_type?: string | null;
  funnel_stages?: { name: string } | null;
  labels?: Array<{ id: string; name: string; color: string }>;
}

export interface ConversationData {
  id: string;
  status: ConversationStatus;
  is_favorite?: boolean | null;
  lead_id: string;
  unread_count?: number;
  assigned_to?: string | null;
}

interface InboxContextType {
  // Selection state
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Data
  selectedConversation: ConversationData | null;
  messages: Message[] | undefined;
  lead: LeadWithLabels | null;

  // Loading states
  isLoadingMessages: boolean;
  isLoadingLead: boolean;
  isLoadingMoreMessages: boolean;
  isUpdatingStatus: boolean;

  // Pagination
  hasMoreMessages: boolean;
  fetchMoreMessages: () => void;

  // Handlers
  onSendMessage: (
    content: string,
    type: string,
    mediaUrl?: string | null,
    replyToExternalId?: string | null
  ) => Promise<void>;
  onStatusChange: (status: ConversationStatus) => void;
  onToggleFavorite: () => void;
  onTransfer: (userId: string) => Promise<void>;
  onMarkAsRead: () => void;

  // UI state
  showLeadPanel: boolean;
  setShowLeadPanel: (show: boolean) => void;

  // Agent info
  agentName?: string;

  // Optimistic update functions (for realtime)
  addMessageOptimistically: (message: any) => void;
  updateMessageOptimistically: (id: string, updates: Partial<Message>) => void;
  replaceOptimisticMessage: (tempId: string, realMessage: Message) => void;
  markMessageFailed: (id: string, error: string) => void;
  removeMessage: (id: string) => void;

  // Refs for internal use
  userClickedConversationRef: React.MutableRefObject<boolean>;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

const LEAD_PANEL_STORAGE_KEY = 'inbox-show-lead-panel-v2';

interface InboxProviderProps {
  children: ReactNode;
}

export function InboxProvider({ children }: InboxProviderProps) {
  const { user, authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Orchestration state
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showLeadPanel, setShowLeadPanel] = useState(() => {
    const saved = localStorage.getItem(LEAD_PANEL_STORAGE_KEY);
    return saved === 'true';
  });
  const userClickedConversationRef = useRef(false);

  // Data hooks
  const { data: selectedConversationRaw } = useConversation(selectedConversationId || undefined);

  const {
    messages,
    isLoading: loadingMessages,
    hasNextPage: hasMoreMessages,
    fetchNextPage: fetchMoreMessages,
    isFetchingNextPage: loadingMoreMessages,
    addMessageOptimistically,
    updateMessageOptimistically,
    replaceOptimisticMessage,
    markMessageFailed,
    removeMessage,
  } = useMessagesInfinite(selectedConversationId || undefined);

  const {
    data: leadData,
    refetch: refetchLead,
    isLoading: loadingLead,
  } = useLead(selectedConversationRaw?.lead_id || undefined);
  const { data: leadLabels } = useLeadLabels(selectedConversationRaw?.lead_id || undefined);

  // Mutations
  const sendMessage = useSendMessage();
  const markAsRead = useMarkConversationAsRead();
  const toggleFavorite = useToggleConversationFavorite();
  const updateAssignee = useUpdateConversationAssignee();
  const updateLead = useUpdateLead();
  const updateConversationStatus = useUpdateConversationStatus();

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
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('conversation');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, selectedConversationId, setSearchParams]);

  // Reset click flag on conversation change
  useEffect(() => {
    userClickedConversationRef.current = false;
  }, [selectedConversationId]);

  // Prepare conversation data
  const selectedConversation = useMemo<ConversationData | null>(() => {
    if (!selectedConversationRaw) return null;
    return {
      id: selectedConversationRaw.id,
      status: selectedConversationRaw.status,
      is_favorite: (selectedConversationRaw as any).is_favorite,
      lead_id: selectedConversationRaw.lead_id,
      unread_count: selectedConversationRaw.unread_count,
      assigned_to: selectedConversationRaw.assigned_to,
    };
  }, [selectedConversationRaw]);

  // Prepare lead with labels
  const leadWithLabels = useMemo<LeadWithLabels | null>(() => {
    if (!leadData) return null;
    return {
      ...leadData,
      labels: leadLabels?.map((ll: any) => ll.labels) || [],
    };
  }, [leadData, leadLabels]);

  // Handlers
  const handleSendMessage = useCallback(
    async (
      content: string,
      type: string,
      mediaUrl?: string | null,
      replyToExternalId?: string | null
    ) => {
      if (!selectedConversationId || !user) return;

      // AUTO-ATRIBUIÇÃO
      const isUnassigned = !selectedConversation?.assigned_to;

      if (isUnassigned && leadData) {
        Promise.all([
          updateAssignee.mutateAsync({
            conversationId: selectedConversationId,
            assignedTo: user.id,
          }),
          updateLead.mutateAsync({
            id: leadData.id,
            assigned_to: user.id,
          }),
        ])
          .then(() => {
            toast.info('Lead atribuído a você automaticamente');
          })
          .catch((error) => {
            logger.error('Erro na auto-atribuição:', error);
          });
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // Adicionar mensagem otimista
      addMessageOptimistically({
        id: tempId,
        conversation_id: selectedConversationId,
        content,
        type: type as any,
        sender_type: 'agent',
        sender_id: user.id,
        status: 'sending',
        created_at: new Date().toISOString(),
        source: 'crm',
        media_url: mediaUrl || null,
        is_starred: false,
        direction: 'outbound',
        is_internal_note: false,
        lead_id: null,
        external_id: null,
        reply_to_external_id: replyToExternalId || null,
        quoted_message: null,
        isOptimistic: true,
      });

      // API em background
      sendMessage
        .mutateAsync({
          conversation_id: selectedConversationId,
          sender_id: user.id,
          sender_type: 'agent',
          content,
          type: type as any,
          media_url: mediaUrl,
          reply_to_external_id: replyToExternalId || undefined,
        })
        .then((realMessage) => {
          if (realMessage) {
            replaceOptimisticMessage(tempId, realMessage);
          } else {
            updateMessageOptimistically(tempId, { status: 'sent' });
          }
        })
        .catch((error) => {
          const errorMsg = error instanceof Error ? error.message : 'Erro ao enviar';
          markMessageFailed(tempId, errorMsg);
        });
    },
    [
      selectedConversationId,
      selectedConversation?.assigned_to,
      user,
      leadData,
      sendMessage,
      updateAssignee,
      updateLead,
      addMessageOptimistically,
      replaceOptimisticMessage,
      updateMessageOptimistically,
      markMessageFailed,
    ]
  );

  const handleStatusChange = useCallback(
    (status: ConversationStatus) => {
      if (!selectedConversationId) return;
      updateConversationStatus.mutate(
        { conversationId: selectedConversationId, status },
        {
          onSuccess: () => {
            const statusLabels = { open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida' };
            toast.success(`Conversa marcada como ${statusLabels[status]}`);
          },
          onError: (error) => {
            const message = getErrorWithFallback(error, 'Erro ao atualizar status');
            toast.error(message);
          },
        }
      );
    },
    [selectedConversationId, updateConversationStatus]
  );

  const handleToggleFavorite = useCallback(() => {
    if (!selectedConversationId || !selectedConversation) return;
    toggleFavorite.mutate({
      conversationId: selectedConversationId,
      isFavorite: !selectedConversation.is_favorite,
    });
  }, [selectedConversationId, selectedConversation, toggleFavorite]);

  const handleTransfer = useCallback(
    async (userId: string) => {
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
        const message = getErrorWithFallback(error, 'Erro ao transferir lead');
        toast.error(message);
      }
    },
    [selectedConversationId, leadData, updateAssignee, updateLead]
  );

  const handleMarkAsRead = useCallback(() => {
    if (selectedConversationId) {
      markAsRead.mutate(selectedConversationId);
    }
  }, [selectedConversationId, markAsRead]);

  const value = useMemo<InboxContextType>(
    () => ({
      // Selection state
      selectedConversationId,
      setSelectedConversationId,

      // Data
      selectedConversation,
      messages,
      lead: leadWithLabels,

      // Loading states
      isLoadingMessages: loadingMessages,
      isLoadingLead: loadingLead,
      isLoadingMoreMessages: loadingMoreMessages,
      isUpdatingStatus: updateConversationStatus.isPending,

      // Pagination
      hasMoreMessages: hasMoreMessages ?? false,
      fetchMoreMessages,

      // Handlers
      onSendMessage: handleSendMessage,
      onStatusChange: handleStatusChange,
      onToggleFavorite: handleToggleFavorite,
      onTransfer: handleTransfer,
      onMarkAsRead: handleMarkAsRead,

      // UI state
      showLeadPanel,
      setShowLeadPanel,

      // Agent info
      agentName: authUser?.name,

      // Optimistic update functions
      addMessageOptimistically,
      updateMessageOptimistically,
      replaceOptimisticMessage,
      markMessageFailed,
      removeMessage,

      // Refs
      userClickedConversationRef,
    }),
    [
      selectedConversationId,
      selectedConversation,
      messages,
      leadWithLabels,
      loadingMessages,
      loadingLead,
      loadingMoreMessages,
      updateConversationStatus.isPending,
      hasMoreMessages,
      fetchMoreMessages,
      handleSendMessage,
      handleStatusChange,
      handleToggleFavorite,
      handleTransfer,
      handleMarkAsRead,
      showLeadPanel,
      authUser?.name,
      addMessageOptimistically,
      updateMessageOptimistically,
      replaceOptimisticMessage,
      markMessageFailed,
      removeMessage,
    ]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const context = useContext(InboxContext);
  if (context === undefined) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return context;
}
