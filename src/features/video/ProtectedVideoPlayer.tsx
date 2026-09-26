import { SecureContentView, capabilities } from '@modules/content-protection';
import * as ScreenOrientation from 'expo-screen-orientation';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import * as React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { CONTROLS_HIDE_DELAY_MS, RESUME_IGNORE_TAIL_SECONDS, RESUME_PROMPT_MIN_SECONDS } from '@/constants';
import { useProtectedScreen } from '@/hooks/use-content-protection';
import { useNetwork } from '@/hooks/use-network';
import { useTranslation } from '@/hooks/use-translation';
import { createLogger } from '@/services/logger';
import { usePlayerStore, type QualityLevel } from '@/store/player-store';
import type { CompletionRule } from '@/types/domain';
import { formatTimecode } from '@/utils/format';

import { PlayerControls } from './components/PlayerControls';
import { PlayerSettingsSheet } from './components/PlayerSettingsSheet';
import { Watermark } from './components/Watermark';
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
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [buffering, setBuffering] = React.useState(true);
  const [muted, setMuted] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [activeCaption, setActiveCaption] = React.useState<string | null>(null);
  const [resumePrompt, setResumePrompt] = React.useState<number | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedResume = React.useRef(false);

  // ---- authorization ----------------------------------------------------

  const surfaceUnavailable = !capabilities.supportsSecureSurface;

  const ticketState = usePlaybackTicket(videoId, { enabled: !surfaceUnavailable });
  const { ticket, phase, error, reload, reportPosition } = ticketState;

  const progress = useWatchProgress(lessonId, courseId, completionRule, reportPosition);

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

  /**
   * The quality ceiling is expressed to the *backend*, which prunes the ABR
   * ladder and re-signs the manifest. That keeps rendition selection on the
   * server where it can be authorized, and means a data-saver cap can't be
   * bypassed by editing a local playlist.
   */
  const source = React.useMemo<VideoSource | null>(() => {
    if (!ticket) return null;

    const effectiveQuality: QualityLevel =
      dataSaver && network.metered && preferredQuality === 'auto'
        ? '480p'
        : preferredQuality;

    const url = new URL(ticket.manifestUrl);
    if (effectiveQuality !== 'auto') {
      url.searchParams.set('maxHeight', effectiveQuality.replace('p', ''));
    }
    if (activeCaption) url.searchParams.set('captions', activeCaption);

    return {
      uri: url.toString(),
      headers: ticket.playbackHeaders,
      metadata: { title, artist: subtitle },
      // DRM is wired from the ticket. With `scheme: 'none'` this is omitted
      // entirely and the stream is AES-128/SAMPLE-AES encrypted HLS; flipping
      // the backend to Widevine/FairPlay needs no client change beyond this
      // object being populated.
      drm:
        ticket.drm.scheme !== 'none' && ticket.drm.licenseUrl
          ? {
              type: ticket.drm.scheme,
              licenseServer: ticket.drm.licenseUrl,
              headers: ticket.drm.licenseHeaders,
              certificateUrl: ticket.drm.certificateUrl ?? undefined,
              multiKey: true,
            }
          : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, preferredQuality, dataSaver, network.metered, activeCaption, reloadKey]);

  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 1;
    p.playbackRate = rate;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.audioMixingMode = 'doNotMix';
    p.loop = false;
  });

  const playerRef = React.useRef(player);
  playerRef.current = player;

  // ---- continuity across source swaps -------------------------------------
  //
  // `useVideoPlayer` builds a NEW native player whenever the source changes,
  // and the source changes on every ticket rotation (the backend re-signs the
  // manifest a little before expiry), on a quality change and on a caption
  // change. A new player starts at 0:00, paused — so without this the lesson
  // jumped back to the beginning and stopped every few minutes. The last
  // position and play state are carried over and re-applied once the new
  // player is ready.
  const lastPositionRef = React.useRef(0);
  const wasPlayingRef = React.useRef(false);
  const mutedRef = React.useRef(false);
  const pendingRestoreRef = React.useRef<{ position: number; play: boolean } | null>(null);
  const firstPlayerRef = React.useRef(player);

  React.useEffect(() => {
    if (!player || player === firstPlayerRef.current) return;
    player.muted = mutedRef.current;
    if (lastPositionRef.current > 0) {
      pendingRestoreRef.current = {
        position: lastPositionRef.current,
        play: wasPlayingRef.current,
      };
    }
  }, [player]);

  const [playerFailed, setPlayerFailed] = React.useState(false);

  // ---- player events -----------------------------------------------------

  React.useEffect(() => {
    if (!player) return;

    const subs = [
      player.addListener('playingChange', ({ isPlaying }) => {
        wasPlayingRef.current = isPlaying;
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
          const restore = pendingRestoreRef.current;
          if (restore) {
            pendingRestoreRef.current = null;
            player.currentTime = restore.position;
            if (restore.play) player.play();
          }
        }
      }),

      player.addListener('timeUpdate', ({ currentTime }) => {
        if (pendingRestoreRef.current) return; // new player not yet repositioned
        lastPositionRef.current = currentTime;
        setPosition(currentTime);
        progress.onTick(currentTime, player.duration || 0);
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
    if (player) player.playbackRate = rate;
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
      player.currentTime = resumePrompt;
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
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
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
        />
      </View>
    );
  }

  if (phase === 'expired') {
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
    return (
      <Blocked
        title={t('errors.title')}
        body={t('errors.genericBody')}
        actionLabel={t('player.reload')}
        onAction={() => {
          setPlayerFailed(false);
          // A fresh ticket re-signs the manifest; the position is restored by
          // the continuity logic above.
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

  const surfaceWidth = width;
  const surfaceHeight = isFullscreen ? height : Math.round(width * (9 / 16));

  return (
    <View className="flex-1 bg-black">
      {/* Everything visual lives inside the secure surface, including the
          watermark and the controls, so a capture cannot catch the frame
          with the watermark stripped. */}
      <SecureContentView
        enabled
        style={{ width: surfaceWidth, height: surfaceHeight, backgroundColor: '#000' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.videoPlayer')}
          onPress={() => (controlsVisible ? setControlsVisible(false) : bumpControls())}
          style={{ width: '100%', height: '100%' }}
        >
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
            playing={playing}
            buffering={buffering || phase === 'refreshing'}
            position={position}
            duration={duration || ticket.resumePositionSeconds}
            muted={muted}
            fullscreen={isFullscreen}
            visible={controlsVisible && resumePrompt === null}
            hasCaptions={ticket.captions.length > 0}
            title={title}
            subtitle={subtitle}
            onPlayPause={() => {
              bumpControls();
              if (playing) {
                player.pause();
                void progress.flush(position);
              } else {
                player.play();
              }
            }}
            onSeek={(v) => {
              bumpControls();
              player.currentTime = v;
            }}
            onSeekBy={(delta) => {
              bumpControls();
              player.seekBy(delta);
            }}
            onToggleMute={() => {
              bumpControls();
              const next = !muted;
              setMuted(next);
              mutedRef.current = next;
              player.muted = next;
            }}
            onToggleFullscreen={() => void toggleFullscreen()}
            onOpenSettings={() => {
              bumpControls();
              setSettingsOpen(true);
            }}
            onClose={() => {
              void progress.flush(position);
              onClose();
            }}
          />

          {/* Rendered last → paints above the controls. */}
          <Watermark
            payload={ticket.watermark}
            width={surfaceWidth}
            height={surfaceHeight}
            active
          />

          {resumePrompt !== null ? (
            <View className="absolute inset-0 items-center justify-center bg-black/80 px-8">
              <Text variant="title" className="text-center text-white">
                {t('player.resumePrompt', { time: formatTimecode(resumePrompt) })}
              </Text>
              <View className="mt-5 flex-row gap-3">
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
          ) : null}
        </Pressable>
      </SecureContentView>

      <PlayerSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        availableQualities={availableQualities}
        captions={ticket.captions}
        activeCaption={activeCaption}
        onSelectCaption={setActiveCaption}
        onSelectQuality={() => setReloadKey((k) => k + 1)}
        autoQualityLabel={activeQualityLabel}
      />
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
      <Text variant="caption" className="mt-2 max-w-[320px] text-center text-white/70">
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
