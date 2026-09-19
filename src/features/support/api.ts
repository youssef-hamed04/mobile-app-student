import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { Paginated } from '@/types/api';
import type {
  SupportTicketCategory,
  SupportTicketDetail,
  SupportTicketSummary,
} from '@/types/domain';

/**
 * Support tickets.
 *
 * These complement the direct channels in `services/support.ts` rather than
 * replacing them. A ticket needs a working session; the phone, WhatsApp and
 * email links do not, which is why they remain the documented route for a
 * student who cannot sign in — the platform has no self-service password reset
 * by design.
 *
 * Every route is scoped to the authenticated principal server-side: another
 * student's ticket id is simply not found rather than found and then refused.
 */
export interface CreateTicketPayload {
  subject: string;
  body: string;
  category?: SupportTicketCategory;
  courseId?: string;
}

export const supportApi = {
  list: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Paginated<SupportTicketSummary>>(
      Endpoints.support.tickets,
      { page, pageSize },
      { signal }
    ),

  detail: (ticketId: string, signal?: AbortSignal) =>
    api.get<SupportTicketDetail>(Endpoints.support.ticket(ticketId), undefined, {
      signal,
    }),

  create: (payload: CreateTicketPayload) =>
    api.post<SupportTicketDetail>(Endpoints.support.tickets, payload, { retries: 0 }),

  /** Returns the whole thread, so the reply lands without a second round trip. */
  reply: (ticketId: string, body: string) =>
    api.post<SupportTicketDetail>(Endpoints.support.reply(ticketId), { body }, {
      retries: 0,
    }),
};
