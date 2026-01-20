import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { Database } from '@/integrations/supabase/types';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

interface PaginatedTasksResult {
  tasks: Task[];
  totalCount: number;
}

export function useTasks(page: number = 1, pageSize: number = 50) {
  const { currentTenant, tenants } = useTenant();
  const tenantIds = currentTenant ? [currentTenant.id] : tenants.map((t) => t.id);

  return useQuery({
    queryKey: ['tasks', page, pageSize, currentTenant?.id || 'all'],
    queryFn: async (): Promise<PaginatedTasksResult> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let queryBuilder = supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .order('due_date', { ascending: true })
        .range(from, to);

      // Filter by tenant
      if (tenantIds.length > 0) {
        queryBuilder = queryBuilder.or(`tenant_id.is.null,tenant_id.in.(${tenantIds.join(',')})`);
      }

      const { data, error, count } = await queryBuilder;

      if (error) throw error;
      return { tasks: data || [], totalCount: count || 0 };
    },
    staleTime: 60 * 1000, // 60 segundos
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Evitar refetch desnecessário
    placeholderData: { tasks: [], totalCount: 0 },
  });
}

// Hook to get ALL tasks (for calendar/kanban view without pagination)
export function useAllTasks() {
  const { currentTenant, tenants } = useTenant();
  const tenantIds = currentTenant ? [currentTenant.id] : tenants.map((t) => t.id);

  return useQuery({
    queryKey: ['tasks-all', currentTenant?.id || 'all'],
    queryFn: async () => {
      let queryBuilder = supabase.from('tasks').select('*').order('due_date', { ascending: true });

      // Filter by tenant
      if (tenantIds.length > 0) {
        queryBuilder = queryBuilder.or(`tenant_id.is.null,tenant_id.in.(${tenantIds.join(',')})`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000, // 60 segundos
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Evitar refetch desnecessário
    placeholderData: [],
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 60 * 1000, // 60 segundos
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Evitar refetch desnecessário
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: TaskInsert) => {
      const { data, error } = await supabase.from('tasks').insert(task).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.id] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: {
      taskId: string;
      status: Database['public']['Enums']['task_status'];
    }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ taskId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      await queryClient.cancelQueries({ queryKey: ['tasks-all'] });

      // Snapshot previous values
      const previousTasks = queryClient.getQueryData(['tasks']);
      const previousAllTasks = queryClient.getQueryData(['tasks-all']);

      // Optimistically update paginated query
      queryClient.setQueryData(['tasks'], (old: PaginatedTasksResult | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
        };
      });

      // Optimistically update all tasks query
      queryClient.setQueryData(['tasks-all'], (old: Task[] | undefined) =>
        old?.map((t) => (t.id === taskId ? { ...t, status } : t))
      );

      return { previousTasks, previousAllTasks };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      if (context?.previousAllTasks) {
        queryClient.setQueryData(['tasks-all'], context.previousAllTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
    },
  });
}
