import {
  PlayerRetirement,
  nextPlayIntent,
  safeRemove,
  safely,
  startHotSwap,
  type LifecyclePlayer,
  type Scheduler,
} from '../src/features/video/playerLifecycle';

/**
 * The hot swap that absorbs a playback-ticket rotation, exercised with fake
 * players that behave like expo-video's: every property and method THROWS once
 * the player is released (ERR_USING_RELEASED_SHARED_OBJECT), and subscriptions
 * call back into the player when removed. The production bug - a release on a
 * fixed timer racing React's commit - is reproduced by controlling when the
 * "commit" happens relative to the release.
 */

class ReleasedError extends Error {
  code = 'ERR_USING_RELEASED_SHARED_OBJECT';
}

let nextId = 1;
class FakePlayer implements LifecyclePlayer {
  readonly id = nextId++;
  released = false;
  releaseCount = 0;
  private _time = 0;
  private _playing = false;
  private _muted = false;
  private _status = 'loading';
  private _mixing = 'doNotMix';
  buffered = 0;
  private listeners = new Map<string, Set<(p: never) => void>>();

  private guard() {
    if (this.released) throw new ReleasedError(`player ${this.id} was already released`);
  }
  get currentTime() { this.guard(); return this._time; }
  set currentTime(v: number) { this.guard(); this._time = v; }
  get playing() { this.guard(); return this._playing; }
  get muted() { this.guard(); return this._muted; }
  set muted(v: boolean) { this.guard(); this._muted = v; }
  get bufferedPosition() { this.guard(); return this.buffered; }
  get status() { this.guard(); return this._status; }
  get audioMixingMode() { this.guard(); return this._mixing; }
  set audioMixingMode(v: string) { this.guard(); this._mixing = v; }
  play() { this.guard(); this._playing = true; }
  pause() { this.guard(); this._playing = false; }
  release() {
    this.guard(); // releasing twice is also a use-after-release
    this.released = true;
    this.releaseCount += 1;
  }
  addListener(event: string, cb: (p: never) => void) {
    this.guard();
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return {
      remove: () => {
        this.guard(); // like expo: removing a listener calls into the player
        this.listeners.get(event)!.delete(cb);
      },
    };
  }
  emit(event: string, payload: unknown) {
    for (const cb of this.listeners.get(event) ?? []) cb(payload as never);
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
  setStatus(s: string) { this._status = s; this.emit('statusChange', { status: s }); }
  advance(seconds: number) { if (this._playing) this._time += seconds; }
}

/** A controllable stand-in for "two frames after the commit". */
function manualScheduler() {
  const pending: (() => void)[] = [];
  const schedule: Scheduler = (fn) => {
    pending.push(fn);
    return () => {
      const i = pending.indexOf(fn);
      if (i >= 0) pending.splice(i, 1);
    };
  };
  return { schedule, runAll: () => pending.splice(0).forEach((f) => f()), pending };
}

/**
 * A minimal model of ProtectedVideoPlayer's player state machine, wired
 * exactly like the component: `active` is React state, listeners are attached
 * by an effect keyed on it, and retired players are flushed by an effect that
 * runs AFTER the listener effect of the same commit. `commit()` is React
 * getting round to that commit - possibly much later than the hand-over.
 */
function harness() {
  const sched = manualScheduler();
  const retirement = new PlayerRetirement<FakePlayer>(sched.schedule);
  const ui = { position: 0, playing: false, events: [] as string[] };
  let active = new FakePlayer();
  let current = active; // playerRef.current
  let rendered = active; // what the last commit rendered
  let subs: { remove(): void }[] = [];
  let standby: FakePlayer | null = null;
  const created: FakePlayer[] = [active];

  const attach = (p: FakePlayer) => {
    subs = [
      p.addListener('timeUpdate', (({ currentTime }: { currentTime: number }) => {
        if (p !== current) return; // stale player: ignored
        ui.position = currentTime;
        ui.events.push(`tick ${p.id} ${currentTime}`);
      }) as never),
      p.addListener('playingChange', (({ isPlaying }: { isPlaying: boolean }) => {
        if (p !== current) return;
        // ui.playing is the play intent (wasPlayingRef), kept as the component does.
        ui.playing = nextPlayIntent(ui.playing, isPlaying, p.status);
      }) as never),
    ];
  };
  attach(active);

  /** React commits the latest state: listener effect, then the flush effect. */
  const commit = () => {
    if (rendered === active) return;
    subs.forEach(safeRemove); // cleanup of the previous listener effect
    attach(active);
    rendered = active;
    retirement.flushRetired(active);
  };

  let fallbacks = 0;
  const rotate = (opts: { failWith?: string; createThrows?: boolean } = {}) =>
    startHotSwap<FakePlayer>({
      old: current,
      create: () => {
        if (opts.createThrows) throw new Error('no decoder');
        const p = new FakePlayer();
        created.push(p);
        standby = p;
        return p;
      },
      configure: () => undefined,
      wantsPlaying: () => ui.playing,
      muted: () => false,
      onSwitch: (next) => {
        retirement.retire(current);
        current = next; // playerRef.current, synchronously
        active = next; // setPlayer(next): committed later
        standby = null;
      },
      onFallback: () => {
        fallbacks += 1;
      },
      discard: (p) => {
        standby = null;
        retirement.releaseOnce(p);
      },
      timeoutMs: 12_000,
      pollMs: 150,
    });

  const unmount = () => {
    subs.forEach(safeRemove); // listener cleanup runs first (declared first)
    subs = [];
    retirement.releaseAll(current, standby);
  };

  return {
    sched,
    retirement,
    ui,
    created,
    commit,
    rotate,
    unmount,
    get active() { return active; },
    get current() { return current; },
    get standby() { return standby; },
    get fallbacks() { return fallbacks; },
  };
}

/** Drives a standby from creation to hand-over. */
function primeAndSwitch(h: ReturnType<typeof harness>) {
  const s = h.standby!;
  s.setStatus('readyToPlay');
  s.buffered = h.current.currentTime + 5;
  jest.advanceTimersByTime(200);
}

describe('ticket rotation hot swap: lifecycle-safe player replacement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    nextId = 1;
  });
  afterEach(() => jest.useRealTimers());

  it('0. ROOT CAUSE: the original fixed 1 s release, with a commit that lands later, uses a released player', () => {
    // The pre-fix sequence: switch, release the old player on a 1 s timer, and
    // let React remove its listeners whenever it commits.
    const old = new FakePlayer();
    const subs = [old.addListener('timeUpdate', () => undefined), old.addListener('statusChange', () => undefined)];
    setTimeout(() => old.release(), 1_000);
    jest.advanceTimersByTime(1_500); // the commit is slower than the timer
    const lateCommit = () => subs.forEach((s) => s.remove());
    expect(lateCommit).toThrow(/already released/);
    try {
      lateCommit();
    } catch (e) {
      expect((e as ReleasedError).code).toBe('ERR_USING_RELEASED_SHARED_OBJECT');
    }
  });

  it('1. replaces the player at the live position, keeps playing, and releases the old one once', () => {
    const h = harness();
    const first = h.current;
    first.play();
    first.currentTime = 600;
    h.ui.playing = true;

    h.rotate();
    primeAndSwitch(h);

    const second = h.current;
    expect(second).not.toBe(first);
    expect(second.currentTime).toBe(600);
    expect(second.playing).toBe(true);
    expect(second.muted).toBe(false);
    expect(first.released).toBe(false); // not before the commit

    h.commit();
    h.sched.runAll();
    expect(first.releaseCount).toBe(1);
    expect(second.released).toBe(false);
  });

  it('2. a React commit that lands LATE never meets a released player (the production bug)', () => {
    const h = harness();
    h.current.play();
    h.ui.playing = true;
    h.rotate();
    primeAndSwitch(h);
    const old = h.created[0]!;

    // Seconds pass with no commit: the old fixed timer would have released it.
    jest.advanceTimersByTime(5_000);
    h.sched.runAll();
    expect(old.released).toBe(false);
    expect(h.retirement.pending).toBe(1);

    // The late commit removes the old listeners - on a live player - then the
    // retired player is released after the frame margin.
    expect(() => h.commit()).not.toThrow();
    expect(old.listenerCount()).toBe(0);
    h.sched.runAll();
    expect(old.released).toBe(true);
  });

  it('3. survives many consecutive rotations: one active player, every old one released exactly once', () => {
    const h = harness();
    h.current.play();
    h.ui.playing = true;
    for (let i = 0; i < 8; i += 1) {
      h.current.advance(240);
      h.rotate();
      primeAndSwitch(h);
      // Alternate: commit promptly, or late (after the next rotation started).
      if (i % 2 === 0) h.commit();
      h.sched.runAll();
    }
    h.commit();
    h.sched.runAll();

    const alive = h.created.filter((p) => !p.released);
    expect(alive).toEqual([h.current]);
    for (const p of h.created) expect(p.releaseCount).toBeLessThanOrEqual(1);
    expect(h.current.playing).toBe(true);
  });

  it('4. unmount during a replacement releases standby, active and retiring players once, after the listeners', () => {
    const h = harness();
    h.current.play();
    const cancel = h.rotate();
    const standby = h.standby!;
    standby.setStatus('readyToPlay'); // primed, not switched yet

    cancel(); // the swap effect's cleanup
    expect(standby.released).toBe(true);
    expect(h.fallbacks).toBe(0); // no in-place reload on a player about to go

    expect(() => h.unmount()).not.toThrow();
    for (const p of h.created) expect(p.releaseCount).toBe(1);
  });

  it('4b. unmount after a hand-over but before the commit releases both players once', () => {
    const h = harness();
    h.current.play();
    h.rotate();
    primeAndSwitch(h);
    expect(() => h.unmount()).not.toThrow();
    for (const p of h.created) expect(p.releaseCount).toBe(1);
    expect(() => h.sched.runAll()).not.toThrow();
  });

  it('5. stale native events from the replaced player never move the controls', () => {
    const h = harness();
    h.current.play();
    h.ui.playing = true;
    h.current.currentTime = 900;
    h.rotate();
    primeAndSwitch(h);
    const old = h.created[0]!;

    // Before the commit the old player's listeners are still attached; its late
    // ticks (and a "paused" from its retirement) must be ignored.
    old.emit('timeUpdate', { currentTime: 12 });
    old.emit('playingChange', { isPlaying: false });
    expect(h.ui.position).not.toBe(12);
    expect(h.ui.playing).toBe(true);

    h.commit();
    h.current.emit('timeUpdate', { currentTime: 901 });
    expect(h.ui.position).toBe(901);
  });

  it('6. a failed replacement keeps the current player and falls back to the in-place reload', () => {
    const h = harness();
    const first = h.current;
    h.rotate();
    h.standby!.emit('statusChange', { status: 'error', error: { message: '403' } });
    expect(h.current).toBe(first);
    expect(h.fallbacks).toBe(1);
    expect(h.created[1]!.released).toBe(true);
    expect(first.released).toBe(false);

    // A standby that never gets ready is abandoned at the deadline the same way.
    h.rotate();
    jest.advanceTimersByTime(12_001);
    expect(h.fallbacks).toBe(2);
    expect(h.created[2]!.released).toBe(true);

    // A standby that cannot even be created.
    h.rotate({ createThrows: true });
    expect(h.fallbacks).toBe(3);
    expect(h.current).toBe(first);
  });

  it('7. heartbeat position keeps flowing from the active player across rotations', () => {
    const h = harness();
    h.current.play();
    h.ui.playing = true;
    const seen: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      h.current.currentTime = 100 + i * 240;
      h.current.emit('timeUpdate', { currentTime: h.current.currentTime });
      seen.push(h.ui.position);
      h.rotate();
      primeAndSwitch(h);
      h.commit();
      h.sched.runAll();
      h.current.emit('timeUpdate', { currentTime: h.current.currentTime + 1 });
      seen.push(h.ui.position);
    }
    // Strictly increasing: no frozen value, no step back to an old player's time.
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThan(seen[i - 1]!);
  });

  it('8. never plays two players at once (no duplicated audio, no second play session)', () => {
    const h = harness();
    h.current.play();
    h.ui.playing = true;
    h.rotate();
    const standby = h.standby!;
    standby.setStatus('readyToPlay'); // primes: plays MUTED off-screen
    expect(standby.muted).toBe(true);
    s_ahead(standby, h);
    jest.advanceTimersByTime(200);
    const old = h.created[0]!;
    // At the hand-over the old one is paused and muted at once.
    expect(old.playing).toBe(false);
    expect(old.muted).toBe(true);
    expect(h.current.muted).toBe(false);
    const audible = h.created.filter((p) => !p.released && p.playing && !p.muted);
    expect(audible).toHaveLength(1);
  });

  it('9. no use-after-release anywhere: release, removal and late callbacks are all guarded', () => {
    const p = new FakePlayer();
    const sub = p.addListener('timeUpdate', () => undefined);
    p.release();
    expect(() => safeRemove(sub)).not.toThrow();
    expect(safely(() => p.currentTime, -1)).toBe(-1);
    const r = new PlayerRetirement<FakePlayer>(manualScheduler().schedule);
    r.releaseOnce(p); // already released elsewhere: tolerated, not rethrown
    const q = new FakePlayer();
    r.releaseOnce(q);
    expect(() => r.releaseOnce(q)).not.toThrow();
    expect(q.releaseCount).toBe(1);
    r.retire(q); // retiring a released player is a no-op
    expect(r.pending).toBe(0);
  });

  it('10. pause and resume across a rotation: a paused lesson stays paused, a resumed one plays', () => {
    const h = harness();
    h.current.play();
    h.ui.playing = true;
    h.current.pause();
    h.ui.playing = false;
    h.rotate();
    primeAndSwitch(h);
    expect(h.current.playing).toBe(false);
    h.commit();
    h.sched.runAll();

    h.current.play();
    h.ui.playing = true;
    h.rotate();
    primeAndSwitch(h);
    expect(h.current.playing).toBe(true);
  });

  it('11. a rebuffer on the old player at the hand-over is not a pause: the new player keeps playing', () => {
    // Emulator, 2026-11-12: the old player stalled (isPlaying=false, status
    // loading) just before the switch, and the stall was carried over as
    // "paused" - the lesson stopped by itself after the rotation.
    const h = harness();
    h.current.setStatus('readyToPlay');
    h.current.play();
    h.current.emit('playingChange', { isPlaying: true });
    expect(h.ui.playing).toBe(true);
    h.rotate();
    const old = h.current;
    old.pause(); // Media3 isPlaying=false while rebuffering...
    old.setStatus('loading'); // ...with status loading
    old.emit('playingChange', { isPlaying: false });
    expect(h.ui.playing).toBe(true); // intent unchanged by the stall
    primeAndSwitch(h);
    expect(h.current).not.toBe(old);
    expect(h.current.playing).toBe(true);

    // A real pause (player ready, not loading) still carries over.
    h.commit();
    h.sched.runAll();
    h.current.setStatus('readyToPlay');
    h.current.pause();
    h.current.emit('playingChange', { isPlaying: false });
    expect(h.ui.playing).toBe(false);
    h.rotate();
    primeAndSwitch(h);
    expect(h.current.playing).toBe(false);
  });

  it('nextPlayIntent: only a stall keeps the previous intent', () => {
    expect(nextPlayIntent(true, false, 'loading')).toBe(true);
    expect(nextPlayIntent(false, false, 'loading')).toBe(false);
    expect(nextPlayIntent(true, false, 'readyToPlay')).toBe(false);
    expect(nextPlayIntent(true, false, 'error')).toBe(false);
    expect(nextPlayIntent(false, true, 'readyToPlay')).toBe(true);
  });
});

/** Puts the standby's buffer comfortably past the live position. */
function s_ahead(standby: FakePlayer, h: ReturnType<typeof harness>) {
  standby.buffered = h.current.currentTime + 5;
}
