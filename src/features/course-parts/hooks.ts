import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { qk } from '@/api/query-keys';
import { PAGE_SIZE } from '@/constants';
import type { CoursePart, CoursePartsResponse } from '@/types/domain';

import { coursePartsApi } from './api';

/**
 * The parts of one course.
 *
 * Fetched alongside the course rather than inside it because the two have
 * different lifetimes: the course description is stable, while ownership
 * changes the instant a card is redeemed. Keeping them apart means a
 * redemption can refresh ownership without re-fetching the whole course.
 */
export function useCourseParts(courseId: string | undefined) {
  return useQuery({
    queryKey: qk.courses.parts(courseId ?? 'none'),
    queryFn: ({ signal }) => coursePartsApi.forCourse(courseId!, signal),
    enabled: !!courseId,
    staleTime: 60_000,
  });
}

/**
 * The JOIN sheet's options.
 *
 * `enabled` is driven by the sheet being open rather than the screen being
 * mounted: this is a per-tap question, and fetching it for every course page
 * view would be a request nobody reads. Not cached long either — a redemption
 * in another tab changes the answer, and a stale "purchasable" invites a
 * student to buy what they already hold.
 */
export function useCourseJoinOptions(courseId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.courses.joinOptions(courseId ?? 'none'),
    queryFn: ({ signal }) => coursePartsApi.joinOptions(courseId!, signal),
    enabled: !!courseId && enabled,
    staleTime: 0,
  });
}

/** The parts the student holds, across every course. */
export function useMyCourseParts() {
  return useInfiniteQuery({
    queryKey: qk.courses.myParts({}),
    queryFn: ({ pageParam, signal }) =>
      coursePartsApi.mine(pageParam, PAGE_SIZE, signal),
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
 * Checks a card before spending it.
 *
 * Not a query: it has a side effect on the server's rate-limit bucket, and
 * caching "this code is valid" would be actively wrong the moment someone else
 * redeems it. `useMutation` also gives the screen an explicit idle state, which
 * is what lets the button read "Check" and then "Redeem".
 */
export function useValidateCode(courseId: string | undefined) {
  return useMutation({
    mutationFn: (code: string) => coursePartsApi.validateCode(code, courseId),
  });
}

/**
 * What the student is actually missing.
 *
 * Owning a part through a whole-course grant counts as owning it — otherwise
 * the screen would invite someone to buy what they already hold.
 */
export function unownedParts(data: CoursePartsResponse | undefined): CoursePart[] {
  if (!data?.hasParts || data.ownsAllParts) return [];
  return data.parts.filter((part) => !part.owned);
}

/**
 * Whether the parts panel is worth rendering at all.
 *
 * A course sold whole reports `hasParts: false`, and showing an empty "Parts"
 * heading there would suggest something failed to load.
 */
export function hasSellableParts(data: CoursePartsResponse | undefined): boolean {
  return Boolean(data?.hasParts && data.parts.length > 0);
}
