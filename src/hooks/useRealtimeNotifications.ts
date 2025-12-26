import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export function useRealtimeNotifications(userId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // NOTE: handleMessageInsert removed - now handled by useInboxRealtime

  const handleLeadChange = useCallback((payload: RealtimePayload) => {
    const lead = payload.new as { name: string; stage_id: string };
    const oldLead = payload.old as { stage_id?: string };
    
    if (payload.eventType === 'INSERT') {
      toast({
        title: 'Novo lead cadastrado',
        description: `${lead.name} foi adicionado ao sistema`,
      });
    } else if (payload.eventType === 'UPDATE' && oldLead?.stage_id !== lead.stage_id) {
      toast({
        title: 'Lead atualizado',
        description: `${lead.name} mudou de etapa`,
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  }, [toast, queryClient]);

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
      toast({
        title: notification.title,
        description: notification.message,
        variant: notification.type === 'error' ? 'destructive' : 'default',
      });
      
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [toast, queryClient, userId]);

  const handleTaskChange = useCallback((payload: RealtimePayload) => {
    const task = payload.new as { title: string; status: string; assigned_to: string };
    
    if (payload.eventType === 'INSERT' && task.assigned_to === userId) {
      toast({
        title: 'Nova tarefa atribuída',
        description: task.title,
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [toast, queryClient, userId]);

  useEffect(() => {
    if (!userId) return;

    console.log('[Realtime] Setting up global subscriptions for user:', userId);

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
        console.log('[Realtime] Leads channel status:', status);
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
        console.log('[Realtime] Notifications channel status:', status);
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
        console.log('[Realtime] Tasks channel status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up global subscriptions');
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
