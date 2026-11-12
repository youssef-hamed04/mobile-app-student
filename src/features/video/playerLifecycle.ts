/**
 * Lifecycle of the native players behind ProtectedVideoPlayer.
 *
 * WHY THIS EXISTS (Android emulator, 2026-11-11)
 *
 * A ticket rotation is absorbed by a second, pre-buffered player (the "hot
 * swap"). The first implementation released the replaced player on a fixed
 * one-second timer. React, however, only removes that player's event
 * subscriptions when it commits the render that switched players, and flushes
 * that cleanup when it gets to it - later than one second on a busy device. The
 * cleanup then called `remove()` on a player that was already released; the
 * native call threw `ERR_USING_RELEASED_SHARED_OBJECT` inside React's commit,
 * React stopped rendering ("Should not already be working"), the controls and
 * the heartbeat position froze, the next rotation could not swap, and the
 * stream died when the old ticket was retired. Seen in 3 of 4 rotations.
 *
 * The rules this module enforces:
 *
 *  1. A replaced player is RETIRED, not released: it is paused and muted at
 *     once (no overlapping audio), and released only after React has
 *     committed the render that no longer uses it - signalled by
 *     `flushRetired(active)`, which the component calls from an effect keyed
 *     on the active player and declared after the listener effect, so every
 *     subscription and view reference has moved first. A timer is never the
 *     release guarantee; the scheduler below only adds a frame of margin for
 *     the native view to re-attach.
 *  2. Nothing ever touches a released player: every native call made on a
 *     player that may be retired goes through `safely`, and a subscription
 *     whose player is gone is removed with `safeRemove`.
 *  3. Events from a player that is no longer the active one are ignored
 *     (`isCurrent`), so a late `timeUpdate` from the old player can never move
 *     the visible controls or the heartbeat position backwards.
 *  4. On unmount every player - active, retiring, standby - is released
 *     exactly once, after the listeners are gone.
 */

/** The part of expo-video's VideoPlayer this module relies on. */
export interface LifecyclePlayer {
  currentTime: number;
  readonly playing: boolean;
  muted: boolean;
  readonly bufferedPosition: number;
  readonly status: string;
  audioMixingMode: string;
  play(): void;
  pause(): void;
  release(): void;
  addListener(event: string, listener: (payload: never) => void): { remove(): void };
}

export interface LifecycleLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

/** Runs `fn`; a native call on a released player is reported, never thrown. */
export function safely<T>(fn: () => T, fallback: T, onError?: (e: unknown) => void): T {
  try {
    return fn();
  } catch (e) {
    onError?.(e);
    return fallback;
  }
}

/**
 * The student's play intent after a `playingChange`. expo-video's `playing`
 * is Media3's `isPlaying`, which is also false while the player rebuffers, so
 * `playingChange(false)` during a stall (status `loading`) is NOT a pause and
 * must not clear the intent. Otherwise a rotation that hands over during a
 * momentary stall carries "paused" to the new player and the lesson stops by
 * itself (seen on the emulator, 2026-11-12, at the first hand-over).
 */
export function nextPlayIntent(previous: boolean, isPlaying: boolean, status: string): boolean {
  if (!isPlaying && status === 'loading') return previous;
  return isPlaying;
}

/** Removes a subscription even if its player was released in the meantime. */
export function safeRemove(sub: { remove(): void } | null | undefined): void {
  if (!sub) return;
  try {
    sub.remove();
  } catch {
    // The player behind it is gone; so is the subscription.
  }
}

/** Defers work past the native mount of the current commit (two frames). */
export type Scheduler = (fn: () => void) => () => void;

export const afterNextFrames: Scheduler = (fn) => {
  let cancelled = false;
  let second: number | null = null;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => {
      if (!cancelled) fn();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(first);
    if (second !== null) cancelAnimationFrame(second);
  };
};

/**
 * Tracks replaced players until it is safe to release them, and guarantees
 * each player is released exactly once.
 */
export class PlayerRetirement<P extends LifecyclePlayer = LifecyclePlayer> {
  private readonly retiring = new Set<P>();
  private readonly released = new WeakSet<P>();
  private cancelScheduled: (() => void) | null = null;

  constructor(
    private readonly schedule: Scheduler = afterNextFrames,
    private readonly log?: LifecycleLogger
  ) {}

  /** Silence a replaced player now; release it once the commit has moved on. */
  retire(player: P): void {
    if (this.released.has(player)) return;
    safely(() => {
      player.muted = true;
      player.pause();
    }, undefined);
    this.retiring.add(player);
  }

  /** How many replaced players are still waiting for their release. */
  get pending(): number {
    return this.retiring.size;
  }

  isReleased(player: P): boolean {
    return this.released.has(player);
  }

  /**
   * Called from an effect AFTER React committed `active` (listeners moved,
   * view re-rendered). Releases every retired player other than `active`,
   * after the native view has had a frame to re-attach.
   */
  flushRetired(active: P): void {
    if (this.retiring.size === 0) return;
    this.cancelScheduled?.();
    this.cancelScheduled = this.schedule(() => {
      this.cancelScheduled = null;
      for (const p of [...this.retiring]) {
        if (p === active) continue; // switched back to it: keep it
        this.retiring.delete(p);
        this.releaseOnce(p);
      }
    });
  }

  /** Unmount: release everything, once, with no further scheduling. */
  releaseAll(...others: (P | null | undefined)[]): void {
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    const all = new Set<P>([...this.retiring, ...(others.filter(Boolean) as P[])]);
    this.retiring.clear();
    for (const p of all) this.releaseOnce(p);
  }

  releaseOnce(player: P): void {
    if (this.released.has(player)) return;
    this.released.add(player);
    safely(
      () => player.release(),
      undefined,
      (e) => this.log?.warn('player release failed', { e: String((e as Error)?.message ?? e) })
    );
  }
}

export interface HotSwapOptions<P extends LifecyclePlayer> {
  /** The player currently on screen. Never released by the swap itself. */
  old: P;
  /** Creates the standby for the rotated source; may throw. */
  create: () => P;
  configure: (p: P) => void;
  /** Whether playback should continue on the standby (the student's intent). */
  wantsPlaying: () => boolean;
  muted: () => boolean;
  /** Hand over: the component makes `standby` active and retires `old`. */
  onSwitch: (standby: P, handover: { position: number; playing: boolean }) => void;
  /** Anything went wrong: load the source in place on `old` instead. */
  onFallback: (why: string) => void;
  /** Releases a standby that never became active. */
  discard: (standby: P) => void;
  log?: LifecycleLogger;
  timeoutMs?: number;
  /** Seconds buffered past the live position before switching. */
  aheadSeconds?: number;
  /** Switch anyway after this long primed, if the buffer is slow. */
  maxPrimeMs?: number;
  pollMs?: number;
}

/**
 * Primes a standby player with the rotated source while `old` keeps playing,
 * then hands over at the live position. Never releases `old` (the component
 * retires it after the commit) and releases the standby only if it is
 * abandoned before the hand-over. Returns a cancel function, safe to call at
 * any time, including after the hand-over (then it does nothing).
 */
export function startHotSwap<P extends LifecyclePlayer>(o: HotSwapOptions<P>): () => void {
  const timeoutMs = o.timeoutMs ?? 12_000;
  const aheadSeconds = o.aheadSeconds ?? 2;
  const maxPrimeMs = o.maxPrimeMs ?? 3_000;
  const pollMs = o.pollMs ?? 150;

  let standby: P;
  try {
    standby = o.create();
  } catch (e) {
    o.log?.warn('standby player could not be created', { e: String((e as Error)?.message ?? e) });
    o.onFallback('create failed');
    return () => undefined;
  }
  o.configure(standby);
  safely(() => {
    standby.muted = true;
    // Priming must not take audio focus from the player the student hears.
    standby.audioMixingMode = 'mixWithOthers';
  }, undefined);

  let finished = false;
  let primeTimer: ReturnType<typeof setInterval> | null = null;
  const subs: { remove(): void }[] = [];
  const cleanup = () => {
    subs.splice(0).forEach(safeRemove);
    if (primeTimer) clearInterval(primeTimer);
    primeTimer = null;
    clearTimeout(deadline);
  };
  const abandon = (why: string, fallback: boolean) => {
    if (finished) return;
    finished = true;
    cleanup();
    o.discard(standby);
    o.log?.warn('rotation hot-swap abandoned', { why });
    if (fallback) o.onFallback(why);
  };
  const switchNow = () => {
    if (finished) return;
    finished = true;
    cleanup();
    const position = safely(() => o.old.currentTime, 0);
    const playing = safely(() => o.old.playing, false) || o.wantsPlaying();
    safely(() => {
      standby.currentTime = position;
      standby.audioMixingMode = 'doNotMix';
      standby.muted = o.muted();
      if (playing) standby.play();
      else standby.pause();
    }, undefined, (e) => o.log?.warn('rotation hot-swap switch failed', { e: String((e as Error)?.message ?? e) }));
    o.onSwitch(standby, { position, playing });
    o.log?.info('ticket rotation absorbed without a stall');
  };
  const deadline = setTimeout(() => abandon('timeout', true), timeoutMs);

  subs.push(
    standby.addListener('statusChange', (({ status, error }: { status: string; error?: { message?: string } }) => {
      if (finished) return;
      if (status === 'error') {
        abandon(`error: ${String(error?.message ?? 'unknown')}`, true);
        return;
      }
      if (status !== 'readyToPlay' || primeTimer) return;
      try {
        standby.currentTime = o.old.currentTime;
        standby.play();
      } catch (e) {
        abandon(`prime failed: ${String((e as Error)?.message ?? e)}`, true);
        return;
      }
      const primedAt = Date.now();
      primeTimer = setInterval(() => {
        const ahead = safely(() => standby.bufferedPosition - o.old.currentTime, 0);
        if (ahead >= aheadSeconds || Date.now() - primedAt > maxPrimeMs) switchNow();
      }, pollMs);
    }) as never)
  );

  // Cancelled (unmount, a newer source, a quality change): nothing to fall back to.
  return () => abandon('cancelled', false);
}
