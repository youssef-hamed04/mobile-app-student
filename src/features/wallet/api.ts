import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { Paginated } from '@/types/api';
import type {
  RechargeResult,
  WalletSummary,
  WalletTransaction,
} from '@/types/domain';

/**
 * The student's wallet.
 *
 * Scope, stated plainly because getting it wrong would be a financial bug:
 * **credit is spent on the Library and nowhere else.** Courses and course parts
 * are unlocked by access cards that were paid for offline, and no call in this
 * file — or any course file — debits the balance. If a future screen ever needs
 * to spend credit, the Library is the only place it may do so.
 *
 * Every route is scoped server-side to the authenticated principal. There is no
 * user id to pass and none is accepted, so there is nothing here a tampered
 * client could point at somebody else's balance.
 */
export interface WalletTransactionFilters {
  direction?: 'CREDIT' | 'DEBIT';
  from?: string;
  to?: string;
}

export const walletApi = {
  summary: (signal?: AbortSignal) =>
    api.get<WalletSummary>(Endpoints.wallet.summary, undefined, { signal }),

  transactions: (
    filters: WalletTransactionFilters,
    page: number,
    pageSize: number,
    signal?: AbortSignal
  ) =>
    api.get<Paginated<WalletTransaction>>(
      Endpoints.wallet.transactions,
      { ...filters, page, pageSize },
      { signal }
    ),

  /**
   * Redeems a recharge card into the balance.
   *
   * There is no amount in the request and the server accepts none: the credit
   * is read from the card itself, so a client cannot ask to be given more than
   * the card is worth.
   *
   * `retries: 0` — the endpoint shares the code rate-limit bucket, and
   * repeating a refusal only burns the student's allowance.
   */
  redeem: (code: string) =>
    api.post<RechargeResult>(Endpoints.wallet.redeem, { code }, { retries: 0 }),
};
