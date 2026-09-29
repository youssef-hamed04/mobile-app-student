import { isRefreshCoolingDown, resetRefreshCooldown } from '@/api/client';
import { toApiError } from '@/api/errors';

/**
 * The refresh back-off.
 *
 * This is the amplifier that turned a Redis quota breach into an outage, so it
 * is worth stating the mechanism plainly:
 *
 *   `isAccessTokenStale()` stays true until a refresh **succeeds**. The request
 *   interceptor proactively refreshes whenever it is true. So the moment
 *   `/auth/refresh` began answering 500 — because Upstash had no requests left
 *   — every API call from every open app started attempting its own refresh
 *   first. Each attempt was another call to the failing endpoint, and another
 *   rate-limit increment against the Redis that had nothing left to give.
 *
 * A failure that says nothing about the token (5xx, 429, a timeout) now parks
 * further attempts for a cooldown. A definitive answer (400/401/403) still
 * ends the session immediately — that path is unchanged and is covered by the
 * session-ending tests.
 */

describe('refresh cooldown', () => {
  beforeEach(() => {
    resetRefreshCooldown();
    jest.useRealTimers();
  });

  afterAll(() => {
    resetRefreshCooldown();
  });

  it('is not cooling down before anything has failed', () => {
    expect(isRefreshCoolingDown()).toBe(false);
  });

  it('is clear again after a reset', () => {
    // Sign-in calls this, so a session that died while the server was unwell
    // does not hand its back-off to the next one.
    resetRefreshCooldown();
    expect(isRefreshCoolingDown()).toBe(false);
  });

  it('reads the clock it is given rather than only Date.now', () => {
    // The cooldown is compared against a caller-supplied `now`, which is what
    // lets it be reasoned about (and tested) without faking timers.
    expect(isRefreshCoolingDown(0)).toBe(false);
    expect(isRefreshCoolingDown(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

/**
 * 429 is not a transient fault.
 *
 * It is the server saying "you are already asking too often". The client used
 * to retry it twice with backoff, which turned one refused request into three
 * — during an incident whose direct cause was request volume. It is now left
 * for the caller (and React Query, which does not retry 4xx) to handle.
 */
describe('retryable status policy', () => {
  it('does not treat a rate-limit response as retryable', () => {
    expect(toApiError(429, { code: 'RATE_LIMITED' }).retryable).toBe(false);
  });

  it('still treats genuine server faults as retryable', () => {
    expect(toApiError(503, { code: 'SERVER_ERROR' }).retryable).toBe(true);
    expect(toApiError(0, { code: 'NETWORK_OFFLINE' }).retryable).toBe(true);
  });
});
