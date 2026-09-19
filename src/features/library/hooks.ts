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
import type { LibraryPurchaseKind } from '@/types/domain';

import { type LibraryFilters, libraryApi } from './api';

export function useLibraryBrowse(filters: LibraryFilters) {
  return useInfiniteQuery({
    queryKey: qk.library.browse(filters),
    queryFn: ({ pageParam, signal }) =>
      libraryApi.browse(filters, pageParam, PAGE_SIZE, signal),
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
 * One material, with ownership already resolved by the server.
 *
 * `staleTime: 0` on purpose. Every other list in the app tolerates a slightly
 * old copy, but this screen is where money is spent: a cached "locked" badge on
 * a part the student just bought, or a cached "owned" on one they did not,
 * would both be worse than a brief spinner.
 */
export function useLibraryMaterial(materialId: string | undefined) {
  return useQuery({
    queryKey: qk.library.material(materialId ?? 'none'),
    queryFn: ({ signal }) => libraryApi.material(materialId!, signal),
    enabled: !!materialId,
    staleTime: 0,
  });
}

export function useMyLibrary() {
  return useInfiniteQuery({
    queryKey: qk.library.mine({}),
    queryFn: ({ pageParam, signal }) => libraryApi.mine(pageParam, PAGE_SIZE, signal),
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

export function useLibraryPurchases() {
  return useInfiniteQuery({
    queryKey: qk.library.purchases({}),
    queryFn: ({ pageParam, signal }) =>
      libraryApi.purchases(pageParam, PAGE_SIZE, signal),
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
 * The price, the balance and the shortfall, fetched before the student commits.
 *
 * A mutation rather than a query: a quote is a point-in-time statement about
 * money, and caching one would let the confirm sheet show a figure the server
 * has since stopped agreeing with.
 */
export function useLibraryQuote() {
  return useMutation({
    mutationFn: ({
      kind,
      targetId,
    }: {
      kind: LibraryPurchaseKind;
      targetId: string;
    }) => libraryApi.quote(kind, targetId),
  });
}

/**
 * Buying.
 *
 * Nothing is applied optimistically. The wallet and the entitlements move
 * together inside one server transaction, and the only honest thing the app can
 * do before it answers is wait. Afterwards every affected cache is invalidated
 * — the material (parts flip to owned), the wallet (the balance moved), my
 * library (a new readable document) and the purchase history.
 *
 * `alreadyPurchased` means a retry landed on an existing purchase. That is a
 * success, not a failure, and it must not be reported as a second charge.
 */
export function useLibraryPurchase(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      kind,
      targetId,
    }: {
      kind: LibraryPurchaseKind;
      targetId: string;
    }) => libraryApi.purchase(kind, targetId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.wallet.all }),
        queryClient.invalidateQueries({ queryKey: qk.library.all }),
        materialId
          ? queryClient.invalidateQueries({ queryKey: qk.library.material(materialId) })
          : Promise.resolve(),
      ]);

      toast.success(
        result.alreadyPurchased
          ? t('library.alreadyOwnedBody')
          : t('library.purchaseSuccessBody', { title: result.title })
      );
    },
  });
}

/**
 * Asks for permission to read a document.
 *
 * A mutation because it has a server-side effect — it records the reading and
 * mints a session-bound signature — and because its result must never be
 * replayed from cache after it expires.
 */
export function useOpenDocument() {
  return useMutation({
    mutationFn: (partId: string) => libraryApi.open(partId),
  });
}
