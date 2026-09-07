import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/api/query-keys';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from '@/store/ui-store';
import type { CompletionRule, WatchProgress } from '@/types/domain';

import { lessonsApi } from './api';

export function useLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: qk.lessons.detail(lessonId ?? 'none'),
    queryFn: ({ signal }) => lessonsApi.detail(lessonId!, signal),
    enabled: !!lessonId,
    staleTime: 60_000,
  });
}

/**
 * Lesson lookup by video id, for the player route.
 *
 * Kept separate from `useLesson` rather than folded into it: the two take
 * different identifiers, and conflating them is what produced the earlier
 * `videoId.replace(/^v-/, '')` bug, where a mock id format leaked into a
 * route and silently 404'd against real data.
 */
export function useLessonByVideo(videoId: string | undefined) {
  return useQuery({
    queryKey: qk.lessons.byVideo(videoId ?? 'none'),
    queryFn: ({ signal }) => lessonsApi.byVideo(videoId!, signal),
    enabled: !!videoId,
    staleTime: 60_000,
  });
}

export function useMarkLessonComplete(lessonId: string, courseId?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: () => lessonsApi.markComplete(lessonId),
    onSuccess: async () => {
      toast.success(t('lesson.completed'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.lessons.detail(lessonId) }),
        courseId
          ? queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) })
          : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: qk.home.all }),
      ]);
    },
  });
}

/**
 * Decides whether a lesson counts as complete.
 *
 * The rule comes from the course configuration, never from the client — the
 * spec is explicit that opening a lesson must not complete it. This helper
 * only mirrors the server's rule so the UI can show an accurate "you're 80%
 * of the way to completing this" hint; the server remains authoritative.
 */
export function evaluateCompletion(
  rule: CompletionRule,
  progress: WatchProgress | null,
  contiguousWatchedSeconds: number
): { complete: boolean; requiredPercent: number; reachedPercent: number } {
  if (!progress) return { complete: false, requiredPercent: rule.threshold, reachedPercent: 0 };

  const duration = Math.max(1, progress.durationSeconds);

  const reachedPercent = rule.requireContiguous
    ? Math.min(100, Math.round((contiguousWatchedSeconds / duration) * 100))
    : progress.percent;

  switch (rule.type) {
    case 'MANUAL':
      return { complete: progress.completed, requiredPercent: 0, reachedPercent };
    case 'WATCH_FULL':
      return {
        complete: progress.completed || reachedPercent >= 99,
        requiredPercent: 100,
        reachedPercent,
      };
    case 'WATCH_PERCENT':
    default:
      return {
        complete: progress.completed || reachedPercent >= rule.threshold,
        requiredPercent: rule.threshold,
        reachedPercent,
      };
  }
}
