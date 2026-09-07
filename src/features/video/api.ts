import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { PlaybackTicket, WatchProgress } from '@/types/domain';

export interface HeartbeatPayload {
  positionSeconds: number;
  /** Seconds of new, contiguous playback since the previous heartbeat. */
  watchedDeltaSeconds: number;
  /** Client-observed protection posture, for anomaly detection server-side. */
  protection: {
    secureSurface: boolean;
    recording: boolean;
    externalDisplay: boolean;
  };
}

export interface HeartbeatResponse {
  /** The server can revoke mid-playback (device unbound, access expired). */
  ok: boolean;
  /** Present when the ticket was rotated; the player swaps sources. */
  ticket?: PlaybackTicket;
  /** Set when the backend wants playback to stop immediately. */
  terminate?: { reason: string } | null;
}

export const videoApi = {
  /**
   * Requests playback authorization.
   *
   * This single call is where the whole chain from spec §34 happens
   * server-side: authenticated → account active → course access → lesson
   * access → video ready → device authorized → session valid → concurrency
   * slot available. The client never evaluates any of it; it either receives
   * a ticket or an ApiError code that maps to a specific UI state.
   *
   * `retries: 0` on purpose — a denial is a decision, not a transient fault,
   * and retrying a concurrency rejection makes the problem worse.
   */
  requestTicket: (videoId: string, signal?: AbortSignal) =>
    api.post<PlaybackTicket>(
      Endpoints.playback.ticket(videoId),
      {},
      { retries: 0, signal, timeoutMs: 15_000 }
    ),

  heartbeat: (ticketId: string, payload: HeartbeatPayload) =>
    api.post<HeartbeatResponse>(Endpoints.playback.heartbeat(ticketId), payload, {
      retries: 0,
      timeoutMs: 8000,
    }),

  /** Frees the concurrency slot. Fire-and-forget on unmount. */
  release: (ticketId: string) =>
    api.delete<{ ok: boolean }>(Endpoints.playback.release(ticketId), {
      retries: 0,
      timeoutMs: 5000,
    }),

  saveProgress: (payload: {
    lessonId: string;
    positionSeconds: number;
    watchedSeconds: number;
  }) => api.post<WatchProgress>(Endpoints.progress.upsert, payload, { retries: 0 }),

  flushProgressBatch: (
    items: { lessonId: string; positionSeconds: number; watchedSeconds: number }[]
  ) => api.post<{ accepted: number }>(Endpoints.progress.batch, { items }),
};
