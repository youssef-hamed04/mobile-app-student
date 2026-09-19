import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { Paginated } from '@/types/api';
import type {
  LibraryDocumentTicket,
  LibraryMaterialDetail,
  LibraryMaterialSummary,
  LibraryPurchaseHistoryItem,
  LibraryPurchaseKind,
  LibraryPurchaseResult,
  LibraryQuote,
  MyLibraryItem,
} from '@/types/domain';

/**
 * The Library.
 *
 * Independent of courses in both directions: a student may buy here while
 * enrolled in nothing, and owning every course grants nothing here. This is the
 * **only** place wallet credit is spent.
 *
 * Two properties are load-bearing and neither is the client's to enforce:
 *
 *  - No amount is ever sent. `purchase` carries a kind and a target id; the
 *    price is read from the database inside the transaction, so a tampered
 *    client cannot choose what it pays.
 *  - No document URL is durable. `open` returns a short-lived signature bound
 *    to the reader, and the storage key behind it never leaves the server.
 */
export interface LibraryFilters {
  q?: string;
  universityId?: string;
  facultyId?: string;
  academicYearId?: string;
  subjectId?: string;
}

export const libraryApi = {
  browse: (
    filters: LibraryFilters,
    page: number,
    pageSize: number,
    signal?: AbortSignal
  ) =>
    api.get<Paginated<LibraryMaterialSummary>>(
      Endpoints.library.materials,
      { ...filters, page, pageSize },
      { signal }
    ),

  material: (materialId: string, signal?: AbortSignal) =>
    api.get<LibraryMaterialDetail>(Endpoints.library.material(materialId), undefined, {
      signal,
    }),

  /** Everything the student can currently open. */
  mine: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Paginated<MyLibraryItem>>(
      Endpoints.library.mine,
      { page, pageSize },
      { signal }
    ),

  purchases: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Paginated<LibraryPurchaseHistoryItem>>(
      Endpoints.library.myPurchases,
      { page, pageSize },
      { signal }
    ),

  /**
   * Prices an item without buying it.
   *
   * Computed by the same path the purchase uses, so the figure shown on the
   * confirm sheet is the figure that will be charged — not a client-side
   * reconstruction that could drift from it.
   */
  quote: (kind: LibraryPurchaseKind, targetId: string, signal?: AbortSignal) =>
    api.post<LibraryQuote>(Endpoints.library.quote, { kind, targetId }, { signal }),

  /**
   * Buys a part or a package.
   *
   * `retries: 0`. The server is idempotent — a duplicate returns the original
   * purchase rather than charging twice — but a client that retries a debit on
   * its own initiative is one bug away from being wrong about that, and the
   * failure mode is somebody's money.
   */
  purchase: (kind: LibraryPurchaseKind, targetId: string) =>
    api.post<LibraryPurchaseResult>(
      Endpoints.library.purchase,
      { kind, targetId },
      { retries: 0, timeoutMs: 20_000 }
    ),

  /**
   * Opens a document the student owns.
   *
   * Never cached and never retried: the URL expires, it is bound to this device
   * and session, and a refusal is a decision rather than a transient fault.
   */
  open: (partId: string, signal?: AbortSignal) =>
    api.post<LibraryDocumentTicket>(Endpoints.library.open(partId), {}, {
      retries: 0,
      signal,
      timeoutMs: 15_000,
    }),
};
