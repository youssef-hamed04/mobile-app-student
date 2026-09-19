import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { Paginated } from '@/types/api';
import type {
  CodeValidation,
  CoursePartPurchase,
  CoursePartsResponse,
} from '@/types/domain';

/**
 * Course parts.
 *
 * Read-only by design. A part is acquired by redeeming a part-scoped access
 * card through the course's existing redemption endpoint — the very same call
 * a whole-course card uses — so there is no purchase function here and none is
 * missing. **Nothing in this file touches the wallet**, because a course never
 * debits it: the money changed hands offline when the card was sold. Wallet
 * credit belongs to the Library alone.
 */
export const coursePartsApi = {
  /**
   * Every sellable part of a course, owned or not.
   *
   * Locked parts still list their section titles — that is what makes a part
   * worth buying — but nothing playable. `hasParts: false` means the course is
   * sold whole, which the caller must render as a normal state rather than an
   * error.
   */
  forCourse: (courseId: string, signal?: AbortSignal) =>
    api.get<CoursePartsResponse>(Endpoints.courses.parts(courseId), undefined, {
      signal,
    }),

  /** What the student holds, with the value frozen at acquisition. */
  mine: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Paginated<CoursePartPurchase>>(
      Endpoints.courseParts.myPurchases,
      { page, pageSize },
      { signal }
    ),

  /**
   * Checks a card without consuming it.
   *
   * `retries: 0` — this endpoint is rate-limited on the code bucket, and a
   * retried check burns the student's allowance for no gain. A refusal here is
   * an answer, not a fault.
   */
  validateCode: (code: string, courseId?: string) =>
    api.post<CodeValidation>(
      Endpoints.codes.validate,
      { code, courseId },
      { retries: 0 }
    ),
};
