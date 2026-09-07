import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { qk } from '@/api/query-keys';
import {
  PROGRESS_FLUSH_DELTA_SECONDS,
  PROGRESS_FLUSH_INTERVAL_MS,
} from '@/constants';
import { useNetwork } from '@/hooks/use-network';
import { KvKeys, kvJson } from '@/services/kv';
import { createLogger } from '@/services/logger';
import type { CompletionRule } from '@/types/domain';

import { videoApi } from './api';

const log = createLogger('watch-progress');

interface QueuedProgress {
  lessonId: string;
  positionSeconds: number;
  watchedSeconds: number;
  at: number;
}

/**
 * Watch-progress tracking.
 *
 * Three problems this solves, none of which a naive "POST every 5 seconds"
 * approach handles:
 *
 *  1. **Write amplification.** Progress is flushed on an interval *or* when
 *     the position has moved materially, whichever comes first, and always on
 *     pause/unmount/background. A one-hour lesson produces a few dozen writes
 *     instead of several hundred.
 *
 *  2. **Seek-cheating.** `contiguousWatched` counts only forward progress in
 *     ~1s steps. Dragging the scrubber to the end adds nothing to it, which
 *     is what lets the course's `requireContiguous` completion rule mean
 *     something. The server still recomputes this — the client value is a
 *     hint, not an authority.
 *
 *  3. **Flaky networks.** A failed flush is queued in MMKV and replayed as a
 *     batch when connectivity returns, so a lesson watched on the metro isn't
 *     lost.
 */
export interface WatchProgressController {
  /** Feed the player's current time here on every tick. */
  onTick: (positionSeconds: number, durationSeconds: number) => void;
  /** Force a flush (pause, unmount, app background). */
  flush: (positionSeconds: number) => Promise<void>;
  /** Seconds of genuinely watched, non-skipped content. */
  contiguousWatched: number;
  /** Percentage against the course's completion rule. */
  completionPercent: number;
  reachedCompletion: boolean;
}

export function useWatchProgress(
  lessonId: string | undefined,
  courseId: string | undefined,
  rule: CompletionRule | undefined,
  onReportToTicket?: (positionSeconds: number, watchedDelta: number) => void
): WatchProgressController {
  const queryClient = useQueryClient();
  const { connected } = useNetwork();

  const lastTickRef = React.useRef<number | null>(null);
  const lastFlushAtRef = React.useRef(0);
  const lastFlushPositionRef = React.useRef(0);
  const durationRef = React.useRef(0);
  const pendingWatchedRef = React.useRef(0);

  const [contiguousWatched, setContiguousWatched] = React.useState(0);
  const contiguousRef = React.useRef(0);

  // ---- offline queue ----------------------------------------------------

  const enqueue = React.useCallback((entry: QueuedProgress) => {
    const queue = kvJson.get<QueuedProgress[]>(KvKeys.progressQueue, []);
    // Collapse repeats for the same lesson — only the furthest position and
    // the summed watch time matter.
    const others = queue.filter((q) => q.lessonId !== entry.lessonId);
    const existing = queue.find((q) => q.lessonId === entry.lessonId);

    const merged: QueuedProgress = existing
      ? {
          lessonId: entry.lessonId,
          positionSeconds: Math.max(existing.positionSeconds, entry.positionSeconds),
          watchedSeconds: existing.watchedSeconds + entry.watchedSeconds,
          at: entry.at,
        }
      : entry;

    kvJson.set(KvKeys.progressQueue, [...others, merged].slice(-40));
  }, []);

  const drainQueue = React.useCallback(async () => {
    const queue = kvJson.get<QueuedProgress[]>(KvKeys.progressQueue, []);
    if (queue.length === 0) return;

    try {
      await videoApi.flushProgressBatch(
        queue.map(({ lessonId: id, positionSeconds, watchedSeconds }) => ({
          lessonId: id,
          positionSeconds,
          watchedSeconds,
        }))
      );
      kvJson.remove(KvKeys.progressQueue);
      log.info('flushed offline progress queue', { count: queue.length });
      await queryClient.invalidateQueries({ queryKey: qk.progress.all });
    } catch (e) {
      log.debug('queue drain failed, will retry', { e: String(e) });
    }
  }, [queryClient]);

  React.useEffect(() => {
    if (connected) void drainQueue();
  }, [connected, drainQueue]);

  // ---- flush ------------------------------------------------------------

  const flush = React.useCallback(
    async (positionSeconds: number) => {
      if (!lessonId) return;

      const watched = pendingWatchedRef.current;
      if (watched <= 0 && Math.abs(positionSeconds - lastFlushPositionRef.current) < 1) {
        return;
      }

      pendingWatchedRef.current = 0;
      lastFlushAtRef.current = Date.now();
      lastFlushPositionRef.current = positionSeconds;

      const payload = {
        lessonId,
        positionSeconds: Math.round(positionSeconds),
        watchedSeconds: Math.round(watched),
      };

      try {
        await videoApi.saveProgress(payload);
        // Keep the lesson + course caches honest without a full refetch.
        void queryClient.invalidateQueries({ queryKey: qk.lessons.detail(lessonId) });
        if (courseId) {
          void queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
        }
      } catch (e) {
        log.debug('progress save failed, queued', { e: String(e) });
        enqueue({ ...payload, at: Date.now() });
      }
    },
    [lessonId, courseId, queryClient, enqueue]
  );

  // ---- tick -------------------------------------------------------------

  const onTick = React.useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      durationRef.current = durationSeconds;

      const previous = lastTickRef.current;
      lastTickRef.current = positionSeconds;

      if (previous !== null) {
        const delta = positionSeconds - previous;
        // Only count natural forward movement (≤ 2s per tick). A jump means
        // a seek, which contributes nothing to contiguous watch time.
        if (delta > 0 && delta <= 2) {
          contiguousRef.current += delta;
          pendingWatchedRef.current += delta;
          setContiguousWatched(contiguousRef.current);
          onReportToTicket?.(positionSeconds, delta);
        } else {
          onReportToTicket?.(positionSeconds, 0);
        }
      }

      const elapsed = Date.now() - lastFlushAtRef.current;
      const moved = Math.abs(positionSeconds - lastFlushPositionRef.current);

      if (elapsed >= PROGRESS_FLUSH_INTERVAL_MS || moved >= PROGRESS_FLUSH_DELTA_SECONDS) {
        void flush(positionSeconds);
      }
    },
    [flush, onReportToTicket]
  );

  // Final flush on unmount — the most commonly lost data point.
  React.useEffect(
    () => () => {
      const last = lastTickRef.current;
      if (last !== null) void flush(last);
    },
    [flush]
  );

  const duration = durationRef.current || 1;

  const completionPercent = rule?.requireContiguous
    ? Math.min(100, Math.round((contiguousWatched / duration) * 100))
    : Math.min(100, Math.round(((lastTickRef.current ?? 0) / duration) * 100));

  const required =
    rule?.type === 'WATCH_FULL' ? 99 : rule?.type === 'MANUAL' ? 101 : (rule?.threshold ?? 90);

  return {
    onTick,
    flush,
    contiguousWatched,
    completionPercent,
    reachedCompletion: completionPercent >= required,
  };
}
