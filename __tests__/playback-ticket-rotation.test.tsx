import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as React from 'react';

/**
 * Ticket rotation as the server sees it: a rotation is a HEARTBEAT that returns
 * the next ticket - it must never re-request a ticket (a new play), and the
 * heartbeat must keep carrying the live position across rotations. Together
 * with the player's lifecycle test, this is what keeps one lesson one play.
 */

jest.mock('@/services/content-protection', () => ({
  contentProtection: {
    canPlayProtectedContent: () => true,
    blockReason: () => null,
    getState: () => ({ available: true, recording: false, externalDisplay: false }),
  },
}));
jest.mock('@/hooks/use-app-state', () => ({ useOnForeground: () => undefined }));

const mockRequestTicket = jest.fn();
const mockHeartbeat = jest.fn();
const mockRelease = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('../src/features/video/api', () => ({
  videoApi: {
    requestTicket: (...a: unknown[]) => mockRequestTicket(...a),
    heartbeat: (...a: unknown[]) => mockHeartbeat(...a),
    release: (...a: unknown[]) => mockRelease(...a),
  },
}));

// eslint-disable-next-line import/first
import { usePlaybackTicket } from '../src/features/video/usePlaybackTicket';

const TTL = 300;
function ticket(n: number, now: number) {
  return {
    ticketId: `t${n}`,
    manifestUrl: `https://media.example/m/${n}.m3u8`,
    playbackHeaders: {},
    drm: { scheme: 'none', licenseUrl: null, certificateUrl: null, licenseHeaders: {} },
    watermark: {},
    captions: [],
    expiresAt: new Date(now + TTL * 1000).toISOString(),
    ttlSeconds: TTL,
    resumePositionSeconds: 0,
    streamSessionId: 'play-1',
    heartbeatIntervalSeconds: 30,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePlaybackTicket: rotation keeps one play and a continuous heartbeat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRequestTicket.mockReset();
    mockHeartbeat.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('rotates through heartbeats only: one ticket request for three rotations, positions keep advancing', async () => {
    let n = 1;
    mockRequestTicket.mockImplementation(async () => ticket(n, Date.now()));
    mockHeartbeat.mockImplementation(async () => ({}));

    const { result } = renderHook(() => usePlaybackTicket('video-1'), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.phase).toBe('ready');
    expect(result.current.ticket?.ticketId).toBe('t1');

    const sentPositions: number[] = [];
    const sentIds: string[] = [];
    mockHeartbeat.mockImplementation(async (id: string, body: { positionSeconds: number }) => {
      sentIds.push(id);
      sentPositions.push(body.positionSeconds);
      return {};
    });

    let position = 0;
    for (let rotation = 1; rotation <= 3; rotation += 1) {
      // Play for most of the ticket's life, reporting positions as the player does.
      for (let s = 0; s < 8; s += 1) {
        position += 30;
        act(() => result.current.reportPosition(position, 30));
        await act(async () => {
          jest.advanceTimersByTime(30_000);
          await Promise.resolve();
        });
      }
      // The proactive rotation: the beat comes back with the next ticket.
      n += 1;
      mockHeartbeat.mockImplementationOnce(async (id: string, body: { positionSeconds: number }) => {
        sentIds.push(id);
        sentPositions.push(body.positionSeconds);
        return { ticket: ticket(n, Date.now()) };
      });
      await act(async () => {
        jest.advanceTimersByTime(30_000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.ticket?.ticketId).toBe(`t${n}`);
      expect(result.current.phase === 'ready' || result.current.phase === 'refreshing').toBe(true);
    }

    // Keep playing on the last ticket: the next beat must carry it.
    position += 30;
    act(() => result.current.reportPosition(position, 30));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    // One play: the ticket was requested once, never again for a rotation.
    expect(mockRequestTicket).toHaveBeenCalledTimes(1);
    // The heartbeat moved to every new ticket in order, never back to an old one.
    const order = sentIds.filter((id, i) => i === 0 || id !== sentIds[i - 1]);
    expect(order).toEqual(['t1', 't2', 't3', 't4']);
    // ...and never reported a position backwards; the last beat has the live one.
    for (let i = 1; i < sentPositions.length; i += 1) {
      expect(sentPositions[i]).toBeGreaterThanOrEqual(sentPositions[i - 1]!);
    }
    expect(sentPositions[sentPositions.length - 1]).toBe(position);
  });

  it('never has two beats on the wire: a slow periodic beat that rotates does not let the rotation beat hit the released ticket', async () => {
    // The server as it behaves: a beat near expiry rotates and RELEASES the old
    // ticket at once; a beat on a released ticket ends the lesson.
    const released = new Set<string>();
    let n = 1;
    let issuedAt = 0;
    const server = (id: string) => {
      if (released.has(id)) {
        return { ok: false, terminate: { reason: 'Playback session already ended' } };
      }
      if (Date.now() - issuedAt >= (TTL - 60) * 1000) {
        released.add(id);
        n += 1;
        issuedAt = Date.now();
        return { ok: true, ticket: ticket(n, Date.now()) };
      }
      return { ok: true };
    };
    mockRequestTicket.mockImplementation(async () => {
      issuedAt = Date.now();
      return ticket(1, Date.now());
    });
    // Every beat is answered only when the test says so: a slow network.
    const wire: { id: string; answer: () => void }[] = [];
    mockHeartbeat.mockImplementation(
      (id: string) =>
        new Promise((resolve) => {
          wire.push({ id, answer: () => resolve(server(id)) });
        })
    );

    const { result } = renderHook(() => usePlaybackTicket('video-1'), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.ticket?.ticketId).toBe('t1');

    // Seven periodic beats come back promptly.
    for (let s = 0; s < 7; s += 1) {
      await act(async () => {
        jest.advanceTimersByTime(30_000);
        await Promise.resolve();
      });
      await act(async () => {
        wire.shift()!.answer();
        for (let i = 0; i < 4; i += 1) await Promise.resolve();
      });
    }
    // The 8th (240 s) is slow: still on the wire when the rotation timer fires (255 s).
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(wire).toHaveLength(1);
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    // The rotation beat waits instead of racing it on the same ticket.
    expect(wire).toHaveLength(1);

    // The slow beat lands: the server rotates on it and releases t1.
    await act(async () => {
      wire.shift()!.answer();
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
    expect(result.current.ticket?.ticketId).toBe('t2');
    // The rotation beat stood down: nothing was sent on the released t1.
    expect(wire).toHaveLength(0);
    expect(result.current.phase).not.toBe('terminated');

    // The next beat goes out on t2 and is accepted.
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(wire.map((w) => w.id)).toEqual(['t2']);
    await act(async () => {
      wire.shift()!.answer();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    });
    expect(result.current.phase === 'ready' || result.current.phase === 'refreshing').toBe(true);
    expect(mockHeartbeat.mock.calls.filter((c) => c[0] === 't1')).toHaveLength(8);
    expect(mockRequestTicket).toHaveBeenCalledTimes(1);
  });
});
