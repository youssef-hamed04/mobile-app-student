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
import type { CourseSummary, EnrollmentMethod } from '@/types/domain';

import { type CourseFilters, coursesApi } from './api';

/**
 * Infinite course list.
 *
 * `getNextPageParam` reads the server's own `hasNext` rather than comparing
 * lengths, so a page that shrinks because of permission filtering doesn't
 * terminate the list early.
 */
export function useCourseList(filters: CourseFilters) {
  return useInfiniteQuery({
    queryKey: qk.courses.list(filters),
    queryFn: ({ pageParam, signal }) =>
      coursesApi.list(filters, pageParam, PAGE_SIZE, signal),
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

export function useMyCourses() {
  return useInfiniteQuery({
    queryKey: qk.courses.mine({}),
    queryFn: ({ pageParam, signal }) => coursesApi.mine(pageParam, PAGE_SIZE, signal),
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

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: qk.courses.detail(courseId ?? 'none'),
    queryFn: ({ signal }) => coursesApi.detail(courseId!, signal),
    enabled: !!courseId,
    staleTime: 2 * 60_000,
  });
}

export function useHomeFeed() {
  return useQuery({
    queryKey: qk.home.feed(),
    queryFn: ({ signal }) => coursesApi.homeFeed(signal),
    staleTime: 60_000,
  });
}

/**
 * Enrollment.
 *
 * Deliberately NOT optimistic: access is a server-authoritative decision and
 * showing unlocked content before the backend confirms would be exactly the
 * class of bug this spec warns about. On success we invalidate rather than
 * patch, so the course detail comes back with whatever state the server
 * actually granted (ACTIVE, PENDING_APPROVAL, PENDING_PAYMENT).
 */
export function useEnroll(courseId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (method: EnrollmentMethod) => coursesApi.enroll(courseId, method),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) }),
        queryClient.invalidateQueries({ queryKey: qk.courses.all }),
        queryClient.invalidateQueries({ queryKey: qk.home.all }),
      ]);

      if (result.state === 'ACTIVE') toast.success(t('access.joinedBody'));
      if (result.state === 'PENDING_APPROVAL') toast.info(t('access.pendingBody'));
      if (result.state === 'PENDING_PAYMENT') toast.info(t('access.paymentPendingBody'));
    },
  });
}

export function useRedeemCode(courseId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (code: string) => coursesApi.redeemCode(courseId, code),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) }),
        queryClient.invalidateQueries({ queryKey: qk.courses.all }),
        queryClient.invalidateQueries({ queryKey: qk.home.all }),
      ]);
      if (result.state === 'ACTIVE') toast.success(t('access.joinedBody'));
    },
  });
}

/** Course-level derived state used by several screens. */
export function courseAccessFlags(course: Pick<CourseSummary, 'access' | 'status'>) {
  const state = course.access.state;
  return {
    hasAccess: state === 'ACTIVE',
    isPending: state === 'PENDING_APPROVAL' || state === 'PENDING_PAYMENT',
    isExpired: state === 'EXPIRED',
    isArchived: state === 'ARCHIVED' || course.status === 'ARCHIVED',
    isRevoked: state === 'REVOKED',
    canJoin:
      state === 'NOT_ENROLLED' &&
      course.status === 'PUBLISHED' &&
      course.access.availableMethods.length > 0,
  };
}
