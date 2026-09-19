import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { qk } from '@/api/query-keys';
import { PAGE_SIZE } from '@/constants';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from '@/store/ui-store';

import { type CreateTicketPayload, supportApi } from './api';

export function useSupportTickets() {
  return useInfiniteQuery({
    queryKey: qk.support.tickets({}),
    queryFn: ({ pageParam, signal }) => supportApi.list(pageParam, PAGE_SIZE, signal),
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

export function useSupportTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: qk.support.ticket(ticketId ?? 'none'),
    queryFn: ({ signal }) => supportApi.detail(ticketId!, signal),
    enabled: !!ticketId,
    staleTime: 30_000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => supportApi.create(payload),
    onSuccess: async (ticket) => {
      queryClient.setQueryData(qk.support.ticket(ticket.id), ticket);
      await queryClient.invalidateQueries({ queryKey: qk.support.all });
      toast.success(t('support.ticketCreatedBody', { reference: ticket.reference }));
    },
  });
}

/**
 * Replying to a ticket.
 *
 * The server returns the whole thread, so the detail cache is written directly
 * from the response rather than invalidated — the new message appears without a
 * second round trip, and without the list jumping while it refetches. The
 * summary list is still invalidated, because replying can move a resolved
 * ticket back to pending and reorder it.
 */
export function useReplyToTicket(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => supportApi.reply(ticketId, body),
    onSuccess: async (ticket) => {
      queryClient.setQueryData(qk.support.ticket(ticketId), ticket);
      await queryClient.invalidateQueries({ queryKey: qk.support.tickets({}) });
    },
  });
}
