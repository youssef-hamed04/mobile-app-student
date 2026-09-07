import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { qk } from '@/api/query-keys';
import { PAGE_SIZE } from '@/constants';
import type { Paginated } from '@/types/api';
import type { AppNotification } from '@/types/domain';

export function useNotifications(unreadOnly: boolean) {
  return useInfiniteQuery({
    queryKey: qk.notifications.list({ unreadOnly }),
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<AppNotification>>(
        Endpoints.notifications.list,
        { page: pageParam, pageSize: PAGE_SIZE, unread: unreadOnly || undefined },
        { signal }
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      items: data.pages.flatMap((p) => p.items),
      total: data.pages[0]?.meta.total ?? 0,
    }),
  });
}

/**
 * Marking as read is optimistic: it's idempotent, low-stakes, and the
 * alternative (a spinner on a list row) feels broken. On failure we roll the
 * cache back rather than leaving a lie on screen.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post(Endpoints.notifications.markRead(id)),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.all });
      const snapshot = queryClient.getQueriesData({ queryKey: qk.notifications.all });

      queryClient.setQueriesData<{ pages: Paginated<AppNotification>[] }>(
        { queryKey: qk.notifications.all },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  items: p.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
                })),
              }
            : old
      );

      queryClient.setQueryData<{ count: number }>(qk.notifications.unread(), (old) =>
        old ? { count: Math.max(0, old.count - 1) } : old
      );

      return { snapshot };
    },
    onError: (_e, _id, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications.unread() });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(Endpoints.notifications.markAllRead),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.notifications.all });
    },
  });
}
