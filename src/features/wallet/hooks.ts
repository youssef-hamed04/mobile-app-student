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

import { type WalletTransactionFilters, walletApi } from './api';

/**
 * The balance.
 *
 * Short `staleTime`: a stale balance is the one number a student will act on,
 * and showing credit that has already been spent turns a clear refusal into a
 * confusing one. The server creates the wallet on first read, so a student who
 * registered before credit existed needs no special case here.
 */
export function useWallet() {
  return useQuery({
    queryKey: qk.wallet.summary(),
    queryFn: ({ signal }) => walletApi.summary(signal),
    staleTime: 15_000,
  });
}

export function useWalletTransactions(filters: WalletTransactionFilters = {}) {
  return useInfiniteQuery({
    queryKey: qk.wallet.transactions(filters),
    queryFn: ({ pageParam, signal }) =>
      walletApi.transactions(filters, pageParam, PAGE_SIZE, signal),
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
 * Redeeming a recharge card.
 *
 * Not optimistic. The credited amount comes from the card and is unknown until
 * the server answers — inventing a figure and correcting it a moment later is
 * precisely the wrong behaviour for money. The balance is invalidated rather
 * than patched for the same reason: the server's number is the only one that
 * counts.
 *
 * Library caches are refreshed too, because affordability changes with the
 * balance: a part that read "not enough credit" a second ago may now be
 * purchasable.
 */
export function useRedeemRecharge() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (code: string) => walletApi.redeem(code),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.wallet.all }),
        queryClient.invalidateQueries({ queryKey: qk.library.all }),
      ]);
      toast.success(
        t('wallet.rechargeSuccess', { amount: result.credited.toString() })
      );
    },
  });
}
