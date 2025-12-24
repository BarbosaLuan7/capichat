import { useMemo } from 'react';
import { useConversations } from './useConversations';
import { useTasks } from './useTasks';
import { useAuthStore } from '@/store/authStore';

export function useSidebarBadges() {
  const { user } = useAuthStore();
  const { data: conversations } = useConversations();
  const { data: tasks } = useTasks();

  const badges = useMemo(() => {
    // Total de mensagens não lidas em todas as conversas visíveis
    const totalUnreadMessages = conversations?.reduce((total, conv) => {
      return total + (conv.unread_count || 0);
    }, 0) || 0;

    // Tarefas pendentes (todo ou in_progress) atribuídas ao usuário
    const pendingTasks = tasks?.filter((task) => {
      const isPending = task.status === 'todo' || task.status === 'in_progress';
      // Admin/manager vê todas, agent vê só as suas
      const isVisible = user?.role === 'admin' || user?.role === 'manager' || task.assigned_to === user?.id;
      return isPending && isVisible;
    }).length || 0;

    return {
      conversations: totalUnreadMessages,
      tasks: pendingTasks,
    };
  }, [conversations, tasks, user?.id, user?.role]);

  return badges;
}
