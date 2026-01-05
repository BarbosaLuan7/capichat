import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export function useRealtimeNotifications(userId?: string) {
  const queryClient = useQueryClient();

  // NOTE: handleMessageInsert removed - now handled by useInboxRealtime

  const handleLeadChange = useCallback((payload: RealtimePayload) => {
    const lead = payload.new as { name: string; stage_id: string };
    const oldLead = payload.old as { stage_id?: string };
    
    if (payload.eventType === 'INSERT') {
      toast.info(`Novo lead cadastrado: ${lead.name}`);
    } else if (payload.eventType === 'UPDATE' && oldLead?.stage_id !== lead.stage_id) {
      toast.info(`Lead atualizado: ${lead.name} mudou de etapa`);
    }
    
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  }, [queryClient]);

  // NOTE: handleConversationChange removed - now handled by useInboxRealtime

  const handleNotificationInsert = useCallback((payload: RealtimePayload) => {
    const notification = payload.new as { 
      title: string; 
      message: string; 
      type: string;
      user_id: string;
    };
    
    // Only show notifications for the current user
    if (notification.user_id === userId) {
      if (notification.type === 'error') {
        toast.error(`${notification.title}: ${notification.message}`);
      } else {
        toast.info(`${notification.title}: ${notification.message}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [queryClient, userId]);

  const handleTaskChange = useCallback((payload: RealtimePayload) => {
    const task = payload.new as { title: string; status: string; assigned_to: string };
    
    if (payload.eventType === 'INSERT' && task.assigned_to === userId) {
      toast.info(`Nova tarefa atribuída: ${task.title}`);
    }
    
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient, userId]);

  useEffect(() => {
    if (!userId) return;

    logger.log('[Realtime] Setting up global subscriptions for user:', userId);

    // NOTE: messages and conversations are handled by useInboxRealtime in the Inbox page
    // This hook only handles leads, notifications, and tasks (used across the app)

    // Subscribe to leads (used in Leads page, Funnel, etc.)
    const leadsChannel = supabase
      .channel('realtime-leads-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => handleLeadChange(payload as unknown as RealtimePayload)
      )
      .subscribe((status) => {
        logger.log('[Realtime] Leads channel status:', status);
      });

    // Subscribe to notifications
    const notificationsChannel = supabase
      .channel('realtime-notifications-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => handleNotificationInsert(payload as unknown as RealtimePayload)
      )
      .subscribe((status) => {
        logger.log('[Realtime] Notifications channel status:', status);
      });

    // Subscribe to tasks
    const tasksChannel = supabase
      .channel('realtime-tasks-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => handleTaskChange(payload as unknown as RealtimePayload)
      )
      .subscribe((status) => {
        logger.log('[Realtime] Tasks channel status:', status);
      });

    return () => {
      logger.log('[Realtime] Cleaning up global subscriptions');
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [
    userId,
    handleLeadChange,
    handleNotificationInsert,
    handleTaskChange,
  ]);
}
