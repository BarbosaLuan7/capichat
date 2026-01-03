import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Tipos focados em notificações administrativas/importantes
// Removido 'message' (mensagens tem seu próprio sistema na inbox)
// Adicionado 'contract' (contrato assinado) e 'system' (avisos do admin)
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'task' | 'lead' | 'contract' | 'system';
  read: boolean;
  link: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
    staleTime: 15 * 1000, // 15 segundos - notificações precisam ser responsivas
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useUnreadNotificationsCount(userId?: string) {
  return useQuery({
    queryKey: ['notifications', 'unread', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 15 * 1000, // 15 segundos
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread'] });
      
      // Snapshot previous values
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);
      const previousUnreadCount = queryClient.getQueryData<number>(['notifications', 'unread']);
      
      // Optimistically update notifications list
      queryClient.setQueryData<Notification[]>(['notifications'], (old) => 
        old?.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      // Optimistically decrement unread count
      queryClient.setQueryData<number>(['notifications', 'unread'], (old) => 
        Math.max(0, (old || 1) - 1)
      );
      
      return { previousNotifications, previousUnreadCount };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(['notifications', 'unread'], context.previousUnreadCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
