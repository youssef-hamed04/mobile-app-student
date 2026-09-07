import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { ApiError, asApiError } from '@/api/errors';
import { TICKET_REFRESH_LEAD_SECONDS } from '@/constants';
import { useOnForeground } from '@/hooks/use-app-state';
import { contentProtection } from '@/services/content-protection';
import { createLogger } from '@/services/logger';
import type { PlaybackTicket } from '@/types/domain';

import { videoApi } from './api';

const log = createLogger('playback-ticket');

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

    const beat = async () => {
      const delta = watchedDeltaRef.current;
      watchedDeltaRef.current = 0;

      const protection = contentProtection.getState();

      try {
        const res = await videoApi.heartbeat(ticket.ticketId, {
          positionSeconds: Math.round(positionRef.current),
          watchedDeltaSeconds: Math.round(delta),
          protection: {
            secureSurface: protection.available,
            recording: protection.recording,
            externalDisplay: protection.externalDisplay,
          },
        });

        if (res.terminate) {
          log.warn('playback terminated by server', res.terminate);
          setPhase('terminated');
          setError(
            new ApiError({
              code: 'PLAYBACK_DENIED',
              status: 403,
              message: res.terminate.reason,
            })
          );
          return;
        }

        if (res.ticket) {
          log.info('ticket rotated');
          setTicket(res.ticket);
        }
      } catch (e) {
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

    const id = setInterval(() => void beat(), intervalMs);

    // Proactive rotation shortly before the manifest URL stops working, so
    // the student never sees a mid-lesson stall.
    const msUntilRefresh = Math.max(
      5_000,
      (ticket.ttlSeconds - TICKET_REFRESH_LEAD_SECONDS) * 1000
    );
    const rotateId = setTimeout(() => {
      setPhase('refreshing');
      void beat().finally(() => setPhase('ready'));
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
