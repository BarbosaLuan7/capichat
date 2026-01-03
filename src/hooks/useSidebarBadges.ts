import { useMemo } from 'react';
import { useConversations } from './useConversations';
import { useAllTasks } from './useTasks';
import { useAuth } from '@/hooks/useAuth';

export function useSidebarBadges() {
  const { authUser: user } = useAuth();
  const { data: conversations } = useConversations();
  const { data: tasks } = useAllTasks();

  const badges = useMemo(() => {
    // Quantidade de conversas não atribuídas com mensagens não lidas
    const unassignedWithUnread = conversations?.filter((conv) => {
      return conv.unread_count > 0 && conv.assigned_to === null;
    }).length || 0;

    // Tarefas pendentes (todo ou in_progress) atribuídas ao usuário
    const pendingTasks = tasks?.filter((task) => {
      const isPending = task.status === 'todo' || task.status === 'in_progress';
      // Admin/manager vê todas, agent vê só as suas
      const isVisible = user?.role === 'admin' || user?.role === 'manager' || task.assigned_to === user?.id;
      return isPending && isVisible;
    }).length || 0;

    return {
      conversations: unassignedWithUnread,
      tasks: pendingTasks,
    };
  }, [conversations, tasks, user?.id, user?.role]);

  return badges;
}
