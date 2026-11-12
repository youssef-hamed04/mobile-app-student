import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { ApiError, asApiError } from '@/api/errors';
import { TICKET_REFRESH_LEAD_SECONDS } from '@/constants';
import { useOnForeground } from '@/hooks/use-app-state';
import { contentProtection } from '@/services/content-protection';
import { createLogger } from '@/services/logger';
import type { ApiErrorCode } from '@/types/api';
import type { PlaybackTicket } from '@/types/domain';

import { videoApi } from './api';

const log = createLogger('playback-ticket');

/**
 * Heartbeat termination reasons that mean "this grant is over, ask for a new
 * one" rather than "you may not watch this". They land in the `expired` phase,
 * whose screen re-issues the ticket and shows the specific reason.
 */
const REISSUABLE_TERMINATIONS = new Set<string>([
  'PLAYBACK_TICKET_EXPIRED',
  'DEVICE_NOT_AUTHORIZED',
  'CONCURRENT_STREAM_LIMIT',
]);

export type TicketPhase =
  | 'idle'
  | 'authorizing'
  | 'ready'
  | 'refreshing'
  | 'denied'
  | 'expired'
  | 'terminated';

export interface PlaybackTicketState {
  phase: TicketPhase;
  ticket: PlaybackTicket | null;
  error: ApiError | null;
  /** Manual retry after a denial or an expiry. */
  reload: () => void;
  /** Called by the player to report position; drives the heartbeat payload. */
  reportPosition: (positionSeconds: number, watchedDeltaSeconds: number) => void;
}

/**
 * Owns the lifecycle of a short-lived playback authorization.
 *
 * Why this is a hook and not a query:
 *   - A ticket is not cacheable. It is single-use-ish, expiring, and tied to
 *     a server-side concurrency slot, so putting it in the query cache (which
 *     persists to disk) would be a security regression. It is deliberately
 *     excluded from persistence in query-client.ts as a second line of
 *     defence.
 *   - It needs an explicit release on unmount so the student isn't locked out
 *     of their own next video by the concurrency limit.
 *
 * Lifecycle:
 *   mount → authorize → heartbeat every N seconds → rotate before expiry
 *         → release on unmount / background
 */
export function usePlaybackTicket(
  videoId: string | undefined,
  options: { enabled?: boolean } = {}
): PlaybackTicketState {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const [phase, setPhase] = React.useState<TicketPhase>('idle');
  const [ticket, setTicket] = React.useState<PlaybackTicket | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const positionRef = React.useRef(0);
  const watchedDeltaRef = React.useRef(0);
  const ticketRef = React.useRef<PlaybackTicket | null>(null);
  ticketRef.current = ticket;
  /** The heartbeat on the wire, if any: beats never overlap (see `beat`). */
  const beatInFlightRef = React.useRef<Promise<void> | null>(null);

  const reportPosition = React.useCallback(
    (positionSeconds: number, watchedDeltaSeconds: number) => {
      positionRef.current = positionSeconds;
      watchedDeltaRef.current += watchedDeltaSeconds;
    },
    []
  );

  // ---- acquire ----------------------------------------------------------

  React.useEffect(() => {
    if (!videoId || !enabled) return;

    const controller = new AbortController();
    let cancelled = false;

    setPhase('authorizing');
    setError(null);

    void (async () => {
      // Refuse before even asking the server when the device cannot render
      // protected content — a ticket issued here would be a wasted
      // concurrency slot and a needless exposure window.
      if (!contentProtection.canPlayProtectedContent()) {
        const reason = contentProtection.blockReason();
        if (!cancelled) {
          setPhase('denied');
          setError(
            new ApiError({
              code:
                reason === 'integrity'
                  ? 'DEVICE_INTEGRITY_FAILED'
                  : reason === 'recording' || reason === 'external-display'
                    ? 'CAPTURE_DETECTED'
                    : 'PLAYBACK_DENIED',
              status: 403,
              message: `Blocked locally: ${reason}`,
            })
          );
        }
        return;
      }

      try {
        const issued = await videoApi.requestTicket(videoId, controller.signal);
        if (cancelled) {
          // Raced with unmount — hand the slot straight back.
          void videoApi.release(issued.ticketId).catch(() => undefined);
          return;
        }
        setTicket(issued);
        setPhase('ready');
        log.info('ticket issued', { ticketId: issued.ticketId, ttl: issued.ttlSeconds });
      } catch (e) {
        if (cancelled) return;
        const apiError = asApiError(e);
        setError(apiError);
        setPhase('denied');
        log.warn('ticket denied', { code: apiError.code });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();

      const active = ticketRef.current;
      if (active) {
        void videoApi.release(active.ticketId).catch(() => undefined);
        setTicket(null);
      }
    };
  }, [videoId, enabled, nonce]);

  // ---- heartbeat + rotation ---------------------------------------------

  React.useEffect(() => {
    if (!ticket || phase !== 'ready') return;

    const intervalMs = Math.max(10, ticket.heartbeatIntervalSeconds) * 1000;

    // Heartbeats never overlap, and each one is sent for the ticket that is
    // current when it leaves. The server rotates on whichever beat arrives
    // near expiry and releases the old ticket at once; a second beat still in
    // flight on the old id then hit "Playback session already ended" and ended
    // the student's lesson (Android emulator, 2026-11-12: a periodic beat and
    // the rotation beat overlapped on a busy JS thread after the app came back
    // from the background). A periodic beat that finds one on the wire is
    // skipped - that one carries the position; the rotation beat waits for it
    // and stands down if it already rotated.
    const beat = async (kind: 'periodic' | 'rotation') => {
      const pending = beatInFlightRef.current;
      if (pending) {
        if (kind === 'periodic') return;
        await pending.catch(() => undefined);
      }
      const sent = ticketRef.current;
      if (!sent || sent.ticketId !== ticket.ticketId) return; // rotated meanwhile
      const run = send(sent);
      beatInFlightRef.current = run;
      try {
        await run;
      } finally {
        if (beatInFlightRef.current === run) beatInFlightRef.current = null;
      }
    };

    /** A response for a ticket that is no longer the current one is stale. */
    const isStale = (sent: PlaybackTicket) => ticketRef.current?.ticketId !== sent.ticketId;

    const send = async (sent: PlaybackTicket) => {
      const delta = watchedDeltaRef.current;
      watchedDeltaRef.current = 0;

      const protection = contentProtection.getState();

      try {
        const res = await videoApi.heartbeat(sent.ticketId, {
          positionSeconds: Math.round(positionRef.current),
          watchedDeltaSeconds: Math.round(delta),
          protection: {
            secureSurface: protection.available,
            recording: protection.recording,
            externalDisplay: protection.externalDisplay,
          },
        });

        // The ticket was replaced while this beat was on the wire (a reload, or
        // the lesson closed): its answer describes a grant that is gone. The
        // current ticket's own beats run every server check again.
        if (isStale(sent)) {
          log.info('stale heartbeat response ignored');
          return;
        }

        if (res.terminate) {
          log.warn('playback terminated by server', res.terminate);
          const reason = res.terminate.reason;
          // The server sends a machine code for the reasons the student can
          // act on. Those keep their meaning (an expired grant is re-issued by
          // "reload"; a device problem says so) instead of collapsing into a
          // generic "not allowed".
          if (REISSUABLE_TERMINATIONS.has(reason)) {
            setError(
              new ApiError({ code: reason as ApiErrorCode, status: 403, message: reason })
            );
            setPhase('expired');
            return;
          }
          setPhase('terminated');
          setError(
            new ApiError({
              code: reason === 'NOT_ENROLLED' ? 'NOT_ENROLLED' : 'PLAYBACK_DENIED',
              status: 403,
              message: reason,
            })
          );
          return;
        }

        if (res.ticket) {
          log.info('ticket rotated');
          // Visible to the next beat at once, not only after the re-render.
          ticketRef.current = res.ticket;
          setTicket(res.ticket);
        }
      } catch (e) {
        if (isStale(sent)) return;
        const apiError = asApiError(e);
        // A failed heartbeat must not kill playback on a flaky connection;
        // only an explicit authorization failure does.
        if (
          apiError.code === 'PLAYBACK_TICKET_EXPIRED' ||
          apiError.code === 'SESSION_EXPIRED' ||
          apiError.code === 'DEVICE_NOT_AUTHORIZED' ||
          apiError.code === 'CONCURRENT_STREAM_LIMIT'
        ) {
          setError(apiError);
          setPhase('expired');
        } else {
          log.debug('heartbeat failed (transient)', { code: apiError.code });
        }
      }
    };

    const id = setInterval(() => void beat('periodic'), intervalMs);

    // Proactive rotation shortly before the manifest URL stops working, so
    // the student never sees a mid-lesson stall.
    // Measured from the ticket's absolute expiry, not its original TTL: after
    // a heartbeat that did not rotate, `ttlSeconds` still describes the whole
    // lifetime and would schedule the rotation after the URL had expired.
    const expiresAtMs = new Date(ticket.expiresAt).getTime();
    const msUntilRefresh = Math.max(
      5_000,
      Number.isFinite(expiresAtMs)
        ? expiresAtMs - Date.now() - TICKET_REFRESH_LEAD_SECONDS * 1000
        : (ticket.ttlSeconds - TICKET_REFRESH_LEAD_SECONDS) * 1000
    );
    const rotateId = setTimeout(() => {
      setPhase('refreshing');
      // Back to `ready` only if the beat did not end playback. Setting it
      // unconditionally overwrote a server termination (or an expiry) that the
      // beat had just recorded, and the player carried on as if authorised.
      void beat('rotation').finally(() =>
        setPhase((current) => (current === 'refreshing' ? 'ready' : current))
      );
    }, msUntilRefresh);

    return () => {
      clearInterval(id);
      clearTimeout(rotateId);
    };
  }, [ticket, phase]);

  // ---- expiry safety net -------------------------------------------------

  useOnForeground(() => {
    const active = ticketRef.current;
    if (!active) return;

    if (new Date(active.expiresAt).getTime() <= Date.now()) {
      setPhase('expired');
      setError(
        new ApiError({
          code: 'PLAYBACK_TICKET_EXPIRED',
          status: 401,
          message: 'Ticket expired while backgrounded',
        })
      );
    }
  });

  const reload = React.useCallback(() => {
    const active = ticketRef.current;
    if (active) void videoApi.release(active.ticketId).catch(() => undefined);
    setTicket(null);
    setError(null);
    setPhase('idle');
    // Invalidate anything that might have caused the denial (access changed
    // on another device, enrollment approved in the meantime).
    void queryClient.invalidateQueries();
    setNonce((n) => n + 1);
  }, [queryClient]);

  return { phase, ticket, error, reload, reportPosition };
}
