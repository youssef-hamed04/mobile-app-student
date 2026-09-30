import { useQuery } from '@tanstack/react-query';

import { qk } from '@/api/query-keys';

import { videoApi } from './api';

/**
 * Plays remaining on one video, for display.
 *
 * Deliberately separate from `usePlaybackTicket`, and deliberately incapable
 * of blocking playback. The limit is enforced when a ticket is issued, from
 * the server's own count of `video_plays`; this read exists so the player can
 * warn a student BEFORE their last play rather than refusing afterwards with
 * no explanation.
 *
 * If it fails, nothing happens: the warning is absent and the limit still
 * holds, because the limit was never the client's to know. That is why this
 * hook has no error surface and never retries aggressively — a student on a
 * flaky connection should still be able to watch.
 */
export function usePlayAllowance(videoId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.courses.playAllowance(videoId ?? 'none'),
    queryFn: ({ signal }) => videoApi.allowance(videoId!, signal),
    enabled: !!videoId && enabled,
    // Re-read on each mount: a play consumed on another device changes it,
    // and a stale "2 left" is worse than none.
    staleTime: 0,
    retry: false,
  });
}
