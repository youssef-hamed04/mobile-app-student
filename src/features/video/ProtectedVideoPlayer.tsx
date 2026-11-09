import * as ScreenOrientation from 'expo-screen-orientation';
import { VideoView, createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import * as React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  CONTROLS_HIDE_DELAY_MS,
  PLAYER_ROTATION_HOT_SWAP,
  RESUME_IGNORE_TAIL_SECONDS,
  RESUME_PROMPT_MIN_SECONDS,
} from '@/constants';
import { useProtectedScreen } from '@/hooks/use-content-protection';
import { useNetwork } from '@/hooks/use-network';
import { useTranslation } from '@/hooks/use-translation';
import { createLogger } from '@/services/logger';
import { usePlayerStore, type QualityLevel } from '@/store/player-store';
import type { CompletionRule } from '@/types/domain';
import { formatTimecode } from '@/utils/format';
import { SecureContentView, capabilities } from '@modules/content-protection';

import { PlayerControls } from './components/PlayerControls';
import { PlayerDock } from './components/PlayerDock';
import { PlayerHeader } from './components/PlayerHeader';
import { PlayerSettingsSheet, type SettingsPanel } from './components/PlayerSettingsSheet';
import { Watermark } from './components/Watermark';
import { aspectFromTrack, isImmersive, surfaceFor } from './layout';
import { buildPlayerSource } from './source';
import { usePlayAllowance } from './usePlayAllowance';
import { usePlaybackTicket } from './usePlaybackTicket';
import { useWatchProgress } from './useWatchProgress';

const log = createLogger('player');

export interface ProtectedVideoPlayerProps {
  videoId: string;
  /** Ladder the asset was packaged at, from VideoRef.availableQualities. */
  lessonQualities?: string[];
  lessonId: string;
  courseId: string;
  title: string;
  subtitle?: string;
  completionRule?: CompletionRule;
  onClose: () => void;
  onCompleted?: () => void;
  onEnded?: () => void;
}

/**
 * Protected HLS player.
 *
 * Security posture, top to bottom:
 *
 *  1. **No source until authorized.** The component renders a spinner, not a
 *     player, until the backend issues a ticket. There is no code path that
 *     produces a playable URL without one.
 *  2. **Secure surface.** The video output is parented inside
 *     `SecureContentView` — FLAG_SECURE-backed on Android, the capture-
 *     excluded UITextField canvas on iOS. If the platform can't provide one,
 *     `capabilities.supportsSecureSurface` is false and playback is refused
 *     outright rather than degraded.
 *  3. **Live threat response.** A screenshot pauses playback; a recording or
 *     a mirrored display pauses it and raises the privacy shield until the
 *     capture stops.
 *  4. **Watermark above everything.** Rendered after the controls, at the
 *     highest z-index inside the surface.
 *  5. **No PiP, no background audio, no download.** PiP would move protected
 *     frames into a window outside the secure surface; background audio would
 *     keep the stream alive with no watermark on screen.
 *  6. **Ticket rotation.** Handled by usePlaybackTicket; the source is
 *     swapped in place, preserving position.
 */
export function ProtectedVideoPlayer({
  videoId,
  lessonQualities,
  lessonId,
  courseId,
  title,
  subtitle,
  completionRule,
  onClose,
  onCompleted,
  onEnded,
}: ProtectedVideoPlayerProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const network = useNetwork();

  const rate = usePlayerStore((s) => s.rate);
  const preferredQuality = usePlayerStore((s) => s.preferredQuality);
  const dataSaver = usePlayerStore((s) => s.dataSaver);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const setFullscreen = usePlayerStore((s) => s.setFullscreen);
  const setActiveQualityLabel = usePlayerStore((s) => s.setActiveQualityLabel);
  const activeQualityLabel = usePlayerStore((s) => s.activeQualityLabel);
  const resetSession = usePlayerStore((s) => s.resetSession);

  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [settingsPanel, setSettingsPanel] = React.useState<SettingsPanel | null>(null);
  /**
   * The picture's aspect ratio, from the track the player actually loaded.
   * Null until known (16:9 is assumed meanwhile). Lets the portrait band take
   * the source's shape instead of forcing 16:9 bars onto a 4:3 recording.
   */
  const [videoAspect, setVideoAspect] = React.useState<number | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [buffering, setBuffering] = React.useState(true);
  const [muted, setMuted] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [activeCaption, setActiveCaption] = React.useState<string | null>(null);
  const [resumePrompt, setResumePrompt] = React.useState<number | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPositionRef = React.useRef(0);
  const wasPlayingRef = React.useRef(false);
  /** Mirror of the `playing` state, readable inside listeners without a re-subscribe. */
  const playingRef = React.useRef(false);
  const appliedResume = React.useRef(false);

  // ---- authorization ----------------------------------------------------

  const surfaceUnavailable = !capabilities.supportsSecureSurface;

  const ticketState = usePlaybackTicket(videoId, { enabled: !surfaceUnavailable });
  const { ticket, phase, error, reload: reissue, reportPosition } = ticketState;

  // A reload is the student asking to watch again: the fresh grant's source
  // starts playing, instead of landing paused on the carried position because
  // the player had been paused by the expiry screen.
  const reload = React.useCallback(() => {
    wasPlayingRef.current = true;
    reissue();
  }, [reissue]);

  // Plays remaining, for the warning below. Read once the grant is live, so a
  // student who cannot play the video at all is not told how many plays they
  // have left of something they cannot watch.
  const allowance = usePlayAllowance(videoId, phase === 'ready');

  const progress = useWatchProgress(
    lessonId,
    courseId,
    completionRule,
    reportPosition
  );

  // ---- protection -------------------------------------------------------

  const { blockReason } = useProtectedScreen({
    videoId,
    courseId,
    lessonId,
    onThreat: (threat) => {
      if (threat === 'SCREENSHOT' || threat === 'RECORDING_STARTED') {
        log.warn('capture threat during playback', { threat, lessonId });
        playerRef.current?.pause();
        setPlaying(false);
      }
    },
  });

  // ---- source ------------------------------------------------------------
  //
  // What the native player is handed is decided by `buildPlayerSource`
  // (./source.ts, unit-tested): the independent mobile HLS pipeline gets our
  // per-ticket manifest with the server-enforced quality ceiling, a Gumlet
  // DRM ticket is used exactly as issued. The quality ceiling is a *backend*
  // operation - it prunes the ladder and re-signs - so a data-saver cap cannot
  // be bypassed by editing a local playlist.
  //
  // `reloadKey` is a deliberate dependency: bumping it rebuilds an identical
  // source object, which makes the effect below hand it to the player again
  // (the "reload" action after a failure re-fetches the manifest).
  const effectiveQuality: QualityLevel =
    dataSaver && network.metered && preferredQuality === 'auto' ? '480p' : preferredQuality;

  const source = React.useMemo<VideoSource | null>(() => {
    if (!ticket) return null;

    return buildPlayerSource(ticket, {
      quality: effectiveQuality,
      metadata: { title, artist: subtitle },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, effectiveQuality, reloadKey]);

  /**
   * What, besides the ticket, the current source was built from. A new source
   * with the SAME context is a ticket rotation (same media, re-signed URLs):
   * the only change that can be absorbed by a standby player, below. A
   * quality change or a reload goes through the in-place replace instead.
   */
  const swapContext = React.useMemo(
    () => ({
      quality: effectiveQuality,
      reloadKey,
      drm: ticket?.drm.scheme ?? 'none',
    }),
    [effectiveQuality, reloadKey, ticket?.drm.scheme]
  );
  const loadedContextRef = React.useRef<typeof swapContext | null>(null);

  // ONE native player for the whole lesson. `useVideoPlayer` keys the player
  // on its source argument (JSON-compared) and rebuilds it on any change, and
  // the source changes on every ticket rotation. Rebuilding meant a new
  // decoder, an empty buffer and a restart from 0:00 paused, every few minutes
  // of a long lecture - and on a slow device the rebuild took longer than the
  // interval between rotations, so playback never got going at all. The
  // player is therefore created once with no source, and every source,
  // including the first, is loaded into it with `replaceAsync` below.
  //
  // The player is created by hand (not `useVideoPlayer`) because a ticket
  // rotation is absorbed by a SECOND player: the rotated manifest is loaded and
  // buffered in a standby while the current player keeps playing, and the view
  // is switched to the standby once it has the next seconds in its buffer.
  // The 1-3 s re-buffer of an in-place `replaceAsync` (playlists, key, first
  // segment fetched while the picture is frozen) therefore happens off-screen.
  const configurePlayer = React.useCallback((p: VideoPlayer) => {
    p.timeUpdateEventInterval = 1;
    // Time-stretch instead of resample when the speed changes. expo-video
    // defaults this to false on Android (true on iOS), which raised the
    // lecturer's voice with the speed. Set before the rate: the Android rate
    // setter derives the pitch from the current value.
    p.preservesPitch = true;
    p.playbackRate = usePlayerStore.getState().rate;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.audioMixingMode = 'doNotMix';
    p.loop = false;
  }, []);

  const [player, setPlayer] = React.useState<VideoPlayer>(() => {
    const p = createVideoPlayer(null);
    configurePlayer(p);
    return p;
  });

  const playerRef = React.useRef(player);
  playerRef.current = player;
  /** A standby being primed for a rotation, so it can be released on unmount or cancel. */
  const standbyRef = React.useRef<VideoPlayer | null>(null);

  React.useEffect(() => {
    return () => {
      for (const p of [standbyRef.current, playerRef.current]) {
        try {
          p?.release();
        } catch {
          // Already released.
        }
      }
      standbyRef.current = null;
    };
  }, []);

  // A denied, terminated or expired grant replaces the video surface with an
  // error screen, but the native player outlives the surface: without an
  // explicit pause the audio (and the decode) carried on behind the message.
  React.useEffect(() => {
    if (phase === 'denied' || phase === 'terminated' || phase === 'expired') {
      try {
        playerRef.current?.pause();
      } catch {
        // The player may already be released; nothing left to stop.
      }
    }
  }, [phase]);

  // ---- continuity across source swaps -------------------------------------
  //
  // The source changes on every ticket rotation (the backend re-signs the
  // manifest a little before expiry), on a quality change and on a reload.
  // Loading a new source resets the native player to 0:00, paused, so the
  // position and play state are captured right before the swap and re-applied
  // once the new source reports `readyToPlay`. The same media is behind every
  // rotated manifest, so the seek lands on the same frame.
  const mutedRef = React.useRef(false);
  const pendingRestoreRef = React.useRef<{
    position: number;
    play: boolean;
    /** Swap time; a restore still pending long after it is applied blind. */
    since: number;
  } | null>(null);
  const loadedSourceRef = React.useRef<VideoSource | null>(null);
  /** After a restore seek, early `timeUpdate`s still report the old 0:00. */
  const settleRef = React.useRef<{ position: number; until: number } | null>(null);

  const [playerFailed, setPlayerFailed] = React.useState(false);

  /**
   * Puts the new source where the old one was. Called from whichever signal
   * arrives first - `replaceAsync` resolving on an already-ready player,
   * `statusChange: readyToPlay`, the first `timeUpdate` of the new source, or
   * the safety timer. A rotation that happened while the app was in the
   * background, for instance, produced no `readyToPlay` on return, and the
   * restore stayed pending: the UI froze on the old position while the
   * student's "play" went to a player it no longer described.
   */
  const applyRestore = React.useCallback(() => {
    const restore = pendingRestoreRef.current;
    const p = playerRef.current;
    if (!restore || !p) return;
    pendingRestoreRef.current = null;
    settleRef.current = { position: restore.position, until: Date.now() + 4_000 };
    try {
      p.currentTime = restore.position;
      if (restore.play) p.play();
    } catch (e) {
      log.warn('restore after source swap failed', { e: String((e as Error)?.message ?? e) });
    }
  }, []);

  /**
   * Rotation without a visible stall. The rotated manifest is loaded into a
   * standby player that plays MUTED and off-screen from the current position
   * until it has buffered a little past it; the view then switches to the
   * standby at the live position and the old player is released. Anything
   * that goes wrong (load error, nothing buffered within the timeout) falls
   * back to the in-place replace, which is exactly what happened before.
   * Returns a cancel function.
   */
  const hotSwap = React.useCallback(
    (next: VideoSource, onFallback: () => void): (() => void) => {
      const old = playerRef.current;
      let standby: VideoPlayer;
      try {
        standby = createVideoPlayer(next);
      } catch (e) {
        log.warn('standby player could not be created', { e: String((e as Error)?.message ?? e) });
        onFallback();
        return () => undefined;
      }
      standbyRef.current = standby;
      configurePlayer(standby);
      standby.muted = true;
      // Priming must not take audio focus from the player the student hears.
      standby.audioMixingMode = 'mixWithOthers';

      let finished = false;
      let primeTimer: ReturnType<typeof setInterval> | null = null;
      const subs: { remove: () => void }[] = [];
      const cleanup = () => {
        subs.forEach((s) => s.remove());
        if (primeTimer) clearInterval(primeTimer);
        clearTimeout(deadline);
      };
      const abandon = (why: string) => {
        if (finished) return;
        finished = true;
        cleanup();
        standbyRef.current = null;
        try {
          standby.release();
        } catch {
          // Nothing to release.
        }
        log.warn('rotation hot-swap abandoned', { why });
        onFallback();
      };
      const switchNow = () => {
        if (finished) return;
        finished = true;
        cleanup();
        standbyRef.current = null;
        try {
          const position = old.currentTime;
          const keepPlaying = old.playing || wasPlayingRef.current;
          standby.currentTime = position;
          standby.audioMixingMode = 'doNotMix';
          standby.muted = mutedRef.current;
          if (keepPlaying) standby.play();
          else standby.pause();
          settleRef.current = { position, until: Date.now() + 4_000 };
          old.pause();
        } catch (e) {
          log.warn('rotation hot-swap switch failed', { e: String((e as Error)?.message ?? e) });
        }
        playerRef.current = standby;
        setPlayer(standby);
        // The view re-attaches to the standby on the next render; release the
        // old decoder once that has happened.
        setTimeout(() => {
          try {
            old.release();
          } catch {
            // Already released.
          }
        }, 1_000);
        log.info('ticket rotation absorbed without a stall');
      };
      const deadline = setTimeout(() => abandon('timeout'), 12_000);

      subs.push(
        standby.addListener('statusChange', ({ status, error: standbyError }) => {
          if (status === 'error') {
            abandon(`error: ${String(standbyError?.message ?? 'unknown')}`);
            return;
          }
          if (status !== 'readyToPlay' || primeTimer) return;
          // Ready: start decoding at the live position so the buffer fills
          // around it, then switch once it holds a couple of seconds ahead.
          try {
            standby.currentTime = old.currentTime;
            standby.play();
          } catch (e) {
            abandon(`prime failed: ${String((e as Error)?.message ?? e)}`);
            return;
          }
          const primedAt = Date.now();
          primeTimer = setInterval(() => {
            const ahead = standby.bufferedPosition - old.currentTime;
            if (ahead >= 2 || Date.now() - primedAt > 3_000) switchNow();
          }, 150);
        })
      );
      return () => abandon('cancelled');
    },
    [configurePlayer]
  );

  React.useEffect(() => {
    if (!player || !source || source === loadedSourceRef.current) return;
    const isSwap = loadedSourceRef.current !== null;
    loadedSourceRef.current = source;

    const previousContext = loadedContextRef.current;
    loadedContextRef.current = swapContext;
    const isRotation =
      isSwap &&
      previousContext !== null &&
      previousContext.quality === swapContext.quality &&
      previousContext.reloadKey === swapContext.reloadKey &&
      previousContext.drm === 'none' &&
      swapContext.drm === 'none';

    if (
      PLAYER_ROTATION_HOT_SWAP &&
      isRotation &&
      player.status === 'readyToPlay' &&
      !pendingRestoreRef.current
    ) {
      let fellBack = false;
      const cancel = hotSwap(source, () => {
        // Same path as before this existed: load in place and restore.
        fellBack = true;
        pendingRestoreRef.current = {
          position: lastPositionRef.current,
          play: wasPlayingRef.current,
          since: Date.now(),
        };
        void player
          .replaceAsync(source)
          .then(() => {
            player.muted = mutedRef.current;
            if (player.status === 'readyToPlay') applyRestore();
          })
          .catch((e: unknown) => {
            log.error('source load failed', { e: String((e as Error)?.message ?? e) });
            setPlayerFailed(true);
          });
      });
      return () => {
        if (!fellBack) cancel();
      };
    }

    if (isSwap) {
      // A swap that lands while an earlier one is still loading must not read
      // the half-loaded player's 0:00 as the position to go back to.
      const carried = pendingRestoreRef.current;
      const position = carried ? carried.position : lastPositionRef.current;
      const play = carried ? carried.play : wasPlayingRef.current;
      pendingRestoreRef.current =
        position > 0 || play ? { position, play, since: Date.now() } : null;
    }

    let cancelled = false;
    // Safety net: a `readyToPlay` that was emitted while the app was in the
    // background never reaches the listener, so the player is also polled.
    // Only a READY player is restored - a seek handed to a player that is still
    // loading is dropped, and the lesson then really does restart at 0:00.
    let polls = 0;
    const poll = setInterval(() => {
      if (cancelled || !pendingRestoreRef.current || polls++ > 30) {
        clearInterval(poll);
        return;
      }
      if (player.status === 'readyToPlay') applyRestore();
    }, 1_000);

    void player
      .replaceAsync(source)
      .then(() => {
        if (cancelled) return;
        player.muted = mutedRef.current;
        // Android resolves once the source is set, before `readyToPlay`; the
        // status listener applies the restore then. If the player is already
        // ready here (iOS loads before resolving), apply it now.
        if (player.status === 'readyToPlay') applyRestore();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        log.error('source load failed', { e: String((e as Error)?.message ?? e) });
        setPlayerFailed(true);
      });
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, source, applyRestore, hotSwap]);

  // ---- player events -----------------------------------------------------

  React.useEffect(() => {
    if (!player) return;

    const subs = [
      player.addListener('playingChange', ({ isPlaying }) => {
        wasPlayingRef.current = isPlaying;
        playingRef.current = isPlaying;
        setPlaying(isPlaying);
      }),

      player.addListener('statusChange', ({ status, error: playerError }) => {
        setBuffering(status === 'loading');
        if (status === 'error') {
          // e.g. the CDN refused an expired/revoked manifest, or the stream
          // could not be decoded. Surface it instead of an endless spinner.
          log.error('player error', { e: String(playerError?.message) });
          setPlayerFailed(true);
        }
        if (status === 'readyToPlay') {
          setPlayerFailed(false);
          setDuration(player.duration || 0);
          setActiveQualityLabel(
            preferredQuality === 'auto' ? null : preferredQuality
          );
          applyRestore();
        }
      }),

      player.addListener('timeUpdate', ({ currentTime }) => {
        if (pendingRestoreRef.current) {
          // Ticks from the new source before it is ready are the old 0:00;
          // once it reports ready, put it in place here even if the status
          // event itself was missed.
          if (player.status === 'readyToPlay') applyRestore();
          return;
        }
        const settle = settleRef.current;
        if (settle) {
          // The seek is in flight: ignore the old-source 0:00 that precedes
          // it, for a few seconds at most.
          if (Date.now() < settle.until && currentTime < settle.position - 1.5) return;
          settleRef.current = null;
        }
        lastPositionRef.current = currentTime;
        setPosition(currentTime);
        progress.onTick(currentTime, player.duration || 0);
        // Re-sync the transport state from the player itself. Across an
        // in-place source swap Android reports `playingChange: false` when the
        // old source stops but not always `true` when the new one resumes, and
        // the dock then showed a play icon over a playing video.
        const isPlaying = player.playing;
        if (isPlaying !== playingRef.current) {
          playingRef.current = isPlaying;
          wasPlayingRef.current = isPlaying;
          setPlaying(isPlaying);
        }
        if (isPlaying && player.status === 'readyToPlay') setBuffering(false);
      }),

      // The picture's real shape, once a track is playing. Clamped to the
      // range of anything a lecture could be (square to ultra-wide); a bogus
      // size from a half-loaded track must not collapse the band.
      player.addListener('videoTrackChange', ({ videoTrack }) => {
        const aspect = aspectFromTrack(videoTrack?.size);
        if (aspect !== null) setVideoAspect(aspect);
      }),

      player.addListener('playToEnd', () => {
        // `useVideoPlayer` is called before the ticket exists, so for the first
        // moments of every lesson there is a native player with NO source.
        // expo-video reports that empty timeline as already played to its end,
        // and taking it at face value here closed the screen (or autoplayed the
        // next video) about 250ms after opening it — the lesson never played.
        // A real ending always has a source and a known duration.
        if (!source || (player.duration || 0) <= 0) return;
        setPlaying(false);
        void progress.flush(player.duration || 0);
        onEnded?.();
      }),
    ];

    return () => subs.forEach((s) => s.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, preferredQuality]);

  // Keep playback rate in sync with the persisted preference.
  React.useEffect(() => {
    if (!player) return;
    player.preservesPitch = true;
    player.playbackRate = rate;
  }, [player, rate]);

  // ---- resume ------------------------------------------------------------

  React.useEffect(() => {
    if (!ticket || appliedResume.current) return;

    const resumeAt = ticket.resumePositionSeconds;

    // Already watched to the end last time. Seeking there again puts the player
    // on a timeline that is over before it starts: expo-video reports
    // `playToEnd` at once, which closes the screen, so a finished lesson could
    // never be reopened. Start it over instead — the saved position has served
    // its purpose.
    if (duration > 0 && resumeAt >= duration - RESUME_IGNORE_TAIL_SECONDS) {
      if (player) player.currentTime = 0;
      appliedResume.current = true;
      return;
    }

    if (
      resumeAt > RESUME_PROMPT_MIN_SECONDS &&
      (duration === 0 || resumeAt < duration - RESUME_IGNORE_TAIL_SECONDS)
    ) {
      // Far enough in to be worth asking about — never auto-jump, because
      // silently skipping content the student wanted to rewatch is worse
      // than one extra tap.
      setResumePrompt(resumeAt);
    } else if (resumeAt > 0 && player) {
      player.currentTime = resumeAt;
    }

    appliedResume.current = true;
  }, [ticket, duration, player]);

  const acceptResume = () => {
    if (resumePrompt !== null && player) {
      // The prompt is decided before the duration is known; by the time it is
      // accepted it may be, and a saved position at the very end means the
      // lesson was finished: "resume" there would end it again at once.
      const atEnd =
        duration > 0 && resumePrompt >= duration - RESUME_IGNORE_TAIL_SECONDS;
      player.currentTime = atEnd ? 0 : resumePrompt;
    }
    setResumePrompt(null);
    player?.play();
  };

  const declineResume = () => {
    setResumePrompt(null);
    if (player) player.currentTime = 0;
    player?.play();
  };

  // ---- completion --------------------------------------------------------

  const notifiedCompletion = React.useRef(false);
  React.useEffect(() => {
    if (progress.reachedCompletion && !notifiedCompletion.current) {
      notifiedCompletion.current = true;
      onCompleted?.();
    }
  }, [progress.reachedCompletion, onCompleted]);

  // ---- controls auto-hide -------------------------------------------------

  const bumpControls = React.useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_DELAY_MS
    );
  }, []);

  React.useEffect(() => {
    if (playing) bumpControls();
    else {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setControlsVisible(true);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, bumpControls]);

  // ---- orientation --------------------------------------------------------

  React.useEffect(
    () => () => {
      void ScreenOrientation.unlockAsync();
      resetSession();
    },
    [resetSession]
  );

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setFullscreen(next);
    await ScreenOrientation.lockAsync(
      next
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP
    );
  };

  // ---- render gates --------------------------------------------------------

  if (surfaceUnavailable) {
    return (
      <Blocked
        title={t('security.integrityTitle')}
        body={t('security.integrityBody')}
        onClose={onClose}
      />
    );
  }

  if (blockReason === 'recording' || blockReason === 'external-display') {
    return (
      <Blocked
        title={t('player.recordingDetectedTitle')}
        body={t('player.recordingDetectedBody')}
        onClose={onClose}
      />
    );
  }

  if (blockReason === 'integrity') {
    return (
      <Blocked
        title={t('security.integrityTitle')}
        body={t('security.integrityBody')}
        onClose={onClose}
      />
    );
  }

  if (phase === 'authorizing' || phase === 'idle') {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Spinner label={t('player.authorizing')} />
      </View>
    );
  }

  if (phase === 'denied' || phase === 'terminated') {
    return (
      <View className="flex-1 justify-center bg-black">
        <ErrorState
          error={error}
          onRetry={reload}
          onSecondary={onClose}
          secondaryLabel={t('common.close')}
          onDark
        />
      </View>
    );
  }

  if (phase === 'expired') {
    // The hook reaches `expired` for four different reasons and stores the
    // one that applies — a lapsed ticket, a revoked session, an unbound
    // device, a stream still open elsewhere. Showing "your session expired"
    // for all four told a student to reload when the real answer was "this
    // video is open on another device". So the specific message wins, and the
    // lapsed-ticket copy is the fallback rather than the default.
    if (error && error.code !== 'PLAYBACK_TICKET_EXPIRED') {
      return (
        <View className="flex-1 justify-center bg-black">
          <ErrorState
            error={error}
            onRetry={() => {
              setReloadKey((k) => k + 1);
              reload();
            }}
            onSecondary={onClose}
            secondaryLabel={t('common.close')}
            onDark
          />
        </View>
      );
    }

    return (
      <Blocked
        title={t('player.ticketExpired')}
        body={t('player.ticketExpiredBody')}
        actionLabel={t('player.reload')}
        onAction={() => {
          setReloadKey((k) => k + 1);
          reload();
        }}
        onClose={onClose}
      />
    );
  }

  if (playerFailed) {
    // The one screen that really was generic, and the reason a refusal from
    // the media edge reads as "something went wrong".
    //
    // A decoder fault and a segment the gate refused arrive here identically:
    // the player reports a failure and nothing about it says whether the
    // student's session was revoked, their device unbound, or the file simply
    // will not decode. The player cannot know — but the SERVER can be asked,
    // and `reload()` does exactly that by re-issuing a ticket. So the failure
    // now re-authorizes first: if the reason is an authorization one the hook
    // moves to `denied` with the real code and the branch above renders it,
    // and only a failure that survives re-authorization is reported as a
    // playback fault.
    return (
      <Blocked
        title={t('player.playbackFailed')}
        body={t('player.playbackFailedBody')}
        actionLabel={t('player.reload')}
        onAction={() => {
          setPlayerFailed(false);
          // A fresh ticket re-signs the manifest; the position is restored by
          // the continuity logic above. It is also the only way to learn
          // whether the gate is refusing us.
          reload();
        }}
        onClose={onClose}
      />
    );
  }

  if (!ticket || !source) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Spinner label={t('player.preparing')} />
      </View>
    );
  }

  // The ladder actually packaged for this asset, not a hardcoded list.
  const availableQualities = lessonQualities ?? ['360p', '480p', '720p', '1080p'];

  // ---- layout ---------------------------------------------------------------
  //
  // Two layouts, chosen by what the screen is, not only by the fullscreen
  // toggle: a phone turned on its side without tapping "fullscreen" gets the
  // immersive layout too, because a portrait band plus dock in landscape is
  // a strip of picture with controls under it.
  //
  //   immersive  the picture fills the screen; chrome floats over it and
  //              auto-hides (PlayerControls `overlay`).
  //   portrait   header row → picture band → control dock. Nothing but the
  //              transport cluster and the watermark is ever drawn over the
  //              lecture, so slide text and diagrams at the edges stay visible
  //              and every control has room for a 48dp target.
  //
  // The band takes the source's own shape (16:9 until the track reports
  // otherwise) at the full screen width, capped so the dock always fits. A
  // tall source (4:3, or a portrait recording) is capped by height and
  // centred with bars at the sides. Nothing is ever cropped: lectures carry
  // text at the edges, and `contentFit="contain"` is kept for the same reason.
  const immersive = isImmersive({ width, height, fullscreen: isFullscreen });
  const { width: surfaceWidth, height: surfaceHeight } = surfaceFor({
    width,
    height,
    immersive,
    aspect: videoAspect,
  });

  const toggleControls = () =>
    controlsVisible ? setControlsVisible(false) : bumpControls();

  const onPlayPause = () => {
    bumpControls();
    if (playing) {
      player.pause();
      void progress.flush(position);
    } else {
      player.play();
    }
  };
  const onSeek = (v: number) => {
    bumpControls();
    player.currentTime = v;
  };
  const onSeekBy = (delta: number) => {
    bumpControls();
    player.seekBy(delta);
  };
  const onToggleMute = () => {
    bumpControls();
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    player.muted = next;
  };
  const closePlayer = () => {
    void progress.flush(position);
    onClose();
  };

  // The visual chrome stays INSIDE SecureContentView: the watermark and any
  // control drawn over the picture must be captured with the frame, so a
  // screenshot can never catch the picture with the watermark stripped off.
  const surface = (
    <SecureContentView
      enabled
      style={{ width: surfaceWidth, height: surfaceHeight, backgroundColor: '#000' }}
    >
      <View style={{ width: '100%', height: '100%' }}>
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          nativeControls={false}
          // Both are hard-disabled: either would move protected frames
          // outside the secure surface.
          allowsPictureInPicture={false}
          fullscreenOptions={{ enable: false }}
          allowsVideoFrameAnalysis={false}
          accessible={false}
        />

        <PlayerControls
          mode={immersive ? 'overlay' : 'transport'}
          insets={insets}
          playing={playing}
          buffering={buffering || phase === 'refreshing'}
          position={position}
          duration={duration || ticket.resumePositionSeconds}
          muted={muted}
          fullscreen={immersive}
          visible={controlsVisible && resumePrompt === null}
          hasCaptions={ticket.captions.length > 0}
          title={title}
          subtitle={subtitle}
          onPlayPause={onPlayPause}
          onSeek={onSeek}
          onSeekBy={onSeekBy}
          onToggleMute={onToggleMute}
          onToggleFullscreen={() => void toggleFullscreen()}
          onOpenSettings={() => {
            bumpControls();
            setSettingsPanel('root');
          }}
          onClose={closePlayer}
        />

        {/* Rendered last → paints above the controls. */}
        <Watermark
          payload={ticket.watermark}
          width={surfaceWidth}
          height={surfaceHeight}
          active
        />

        {resumePrompt !== null ? (
          <View className="absolute inset-0 items-center justify-center bg-black/80 px-6">
            <Text variant="title" className="text-center text-white">
              {t('player.resumePrompt', { time: formatTimecode(resumePrompt) })}
            </Text>
            <View className="mt-4 flex-row flex-wrap justify-center gap-3">
              <Button label={t('player.resume')} onPress={acceptResume} />
              <Button
                label={t('player.startOver')}
                variant="secondary"
                onPress={declineResume}
              />
            </View>
          </View>
        ) : null}

        {network.connected === false ? (
          <View className="absolute inset-x-0 top-0 items-center bg-accent py-1">
            <Text variant="caption" className="text-accent-fg">
              {t('network.offlineBanner')}
            </Text>
          </View>
        ) : allowance.data && allowance.data.remaining <= 1 ? (
          /* The last-play warning.
           *
           * Shown only on the final play, and only while the video is
           * actually playing — a count on every video every time would be
           * noise, and the number a student needs is "this is the last
           * one", not "3 of 3".
           *
           * Suppressed while offline, because the banner above is the
           * more urgent message and two stacked banners read as neither.
           *
           * This is advisory. The limit is enforced server-side when the
           * ticket is issued, so a student who never sees this banner is
           * limited identically — the warning exists so the refusal is
           * not a surprise, not to do the enforcing. */
          <View className="absolute inset-x-0 top-0 items-center bg-warning py-1">
            <Text variant="caption" className="text-black">
              {allowance.data.remaining <= 0
                ? t('player.playsExhausted')
                : t('player.lastPlayWarning')}
            </Text>
          </View>
        ) : null}
      </View>
    </SecureContentView>
  );

  const settingsSheet = (
    <PlayerSettingsSheet
      visible={settingsPanel !== null}
      initialPanel={settingsPanel ?? 'root'}
      onClose={() => setSettingsPanel(null)}
      availableQualities={availableQualities}
      captions={ticket.captions}
      activeCaption={activeCaption}
      onSelectCaption={setActiveCaption}
      onSelectQuality={() => setReloadKey((k) => k + 1)}
      autoQualityLabel={activeQualityLabel}
    />
  );

  if (immersive) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        {/* The tap target is the whole screen: a tap anywhere toggles the chrome. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.videoPlayer')}
          onPress={toggleControls}
          style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' }}
        >
          {surface}
        </Pressable>
        {settingsSheet}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <PlayerHeader title={title} subtitle={subtitle} onClose={closePlayer} topInset={insets.top} />

      {/* The band is centred in whatever height the header and dock leave.
          A tap on the band (or the bars beside it) toggles the transport. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('a11y.videoPlayer')}
        onPress={toggleControls}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        {surface}
      </Pressable>

      <PlayerDock
        playing={playing}
        buffering={buffering || phase === 'refreshing'}
        position={position}
        duration={duration || ticket.resumePositionSeconds}
        muted={muted}
        hasCaptions={ticket.captions.length > 0}
        captionsOn={activeCaption !== null}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
        onSeekBy={onSeekBy}
        onToggleMute={onToggleMute}
        onOpenSettings={(panel) => setSettingsPanel(panel)}
        onToggleFullscreen={() => void toggleFullscreen()}
        bottomInset={insets.bottom}
      />

      {settingsSheet}
    </View>
  );
}

function Blocked({
  title,
  body,
  actionLabel,
  onAction,
  onClose,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-black px-8">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Icon name="shieldAlert" size={30} color="#FFFFFF" />
      </View>

      <Text variant="h3" className="text-center text-white">
        {title}
      </Text>
      <Text
        variant="caption"
        className="mt-2 max-w-[320px] text-center text-white/70"
      >
        {body}
      </Text>

      <View className="mt-6 flex-row gap-3">
        {actionLabel && onAction ? (
          <Button label={actionLabel} onPress={onAction} />
        ) : null}
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}
