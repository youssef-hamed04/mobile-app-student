import type { BadgeTone } from '@/components/ui/Badge';
import type { SupportTicketStatus } from '@/types/domain';

/**
 * How a ticket's status reads at a glance.
 *
 * Kept out of the route files so the list and the thread cannot drift into
 * showing the same status two different colours — and so neither screen has to
 * import from the other, which expo-router treats as a route module rather than
 * a plain one.
 *
 * `PENDING` is warning-toned on purpose: it means the ticket is waiting on the
 * student, and that is the one state where they can do something about it.
 */
export const STATUS_TONE: Record<SupportTicketStatus, BadgeTone> = {
  OPEN: 'info',
  PENDING: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};
