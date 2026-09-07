import Slider from '@react-native-community/slider';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { SEEK_STEP_SECONDS } from '@/constants';
import { useTranslation } from '@/hooks/use-translation';
import { usePlayerStore } from '@/store/player-store';
import { brand } from '@/theme/palette';
import { formatTimecode } from '@/utils/format';

export interface PlayerControlsProps {
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  muted: boolean;
  fullscreen: boolean;
  visible: boolean;
  hasCaptions: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekBy: (delta: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  title: string;
  subtitle?: string;
}

/**
 * Player chrome.
 *
 * Two RTL decisions worth stating, because they are the usual source of bugs:
 *
 *  1. The **timeline never mirrors**. Media time flows left→right in every
 *    locale, so the scrubber, the elapsed/remaining labels and the ±10s
 *    buttons keep their physical arrangement in Arabic. Only the *text* is
 *    localized. This matches YouTube, Netflix and the platform players.
 *
 *  2. Everything else — the back button, the settings sheet, the title block
 *    — does mirror, because those are UI, not media.
 *
 * The controls sit *below* the watermark in z-order by construction: the
 * watermark is rendered after this component with zIndex.watermark.
 */
export function PlayerControls({
  playing,
  buffering,
  position,
  duration,
  muted,
  fullscreen,
  visible,
  hasCaptions,
  onPlayPause,
  onSeek,
  onSeekBy,
  onToggleMute,
  onToggleFullscreen,
  onOpenSettings,
  onClose,
  title,
  subtitle,
}: PlayerControlsProps) {
  const { t } = useTranslation();
  const rate = usePlayerStore((s) => s.rate);
  const activeQuality = usePlayerStore((s) => s.activeQualityLabel);

  const [scrubbing, setScrubbing] = React.useState(false);
  const [scrubValue, setScrubValue] = React.useState(0);

  const shown = scrubbing ? scrubValue : position;
  const safeDuration = duration > 0 ? duration : 1;

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0"
      pointerEvents="box-none"
      accessibilityLabel={t('a11y.videoPlayer')}
    >
      {/* ---- top bar --------------------------------------------------- */}
      <View
        className="absolute inset-x-0 top-0 flex-row items-start gap-2 bg-black/55 px-2 pb-6 pt-2"
        pointerEvents="auto"
      >
        <IconButton
          icon="close"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          variant="glass"
          color="#FFFFFF"
        />

        <View className="flex-1 pt-2.5">
          <Text variant="label" className="text-white" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" className="text-white/70" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1 pt-1">
          <View className="flex-row items-center gap-1 rounded-full bg-black/50 px-2 py-1">
            <Icon name="shield" size={12} color={brand.orange} />
            <Text variant="caption" className="text-white/80" style={{ fontSize: 10 }}>
              {t('player.protectedNotice')}
            </Text>
          </View>
        </View>
      </View>

      {/* ---- centre transport ------------------------------------------ */}
      {/* Physical order is fixed (back / play / forward) regardless of
          layout direction — see the note in the component doc. */}
      <View
        className="absolute inset-0 items-center justify-center"
        pointerEvents="box-none"
        style={{ flexDirection: 'row' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 }}>
          <IconButton
            icon="back10"
            size={30}
            accessibilityLabel={t('player.seekBackward')}
            onPress={() => onSeekBy(-SEEK_STEP_SECONDS)}
            variant="glass"
            color="#FFFFFF"
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? t('player.pause') : t('player.play')}
            accessibilityState={{ busy: buffering }}
            onPress={onPlayPause}
            className="h-[72px] w-[72px] items-center justify-center rounded-full bg-black/55 active:opacity-80"
          >
            <Icon
              name={buffering ? 'refresh' : playing ? 'pause' : 'play'}
              size={34}
              color="#FFFFFF"
            />
          </Pressable>

          <IconButton
            icon="forward10"
            size={30}
            accessibilityLabel={t('player.seekForward')}
            onPress={() => onSeekBy(SEEK_STEP_SECONDS)}
            variant="glass"
            color="#FFFFFF"
          />
        </View>
      </View>

      {/* ---- bottom bar ------------------------------------------------ */}
      <View
        className="absolute inset-x-0 bottom-0 gap-1 bg-black/55 px-3 pb-3 pt-8"
        pointerEvents="auto"
        // The timeline block is explicitly LTR so the scrubber and its labels
        // keep media-time orientation in Arabic.
        style={{ direction: 'ltr' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="caption" className="text-white" forceLatin style={{ minWidth: 44 }}>
            {formatTimecode(shown)}
          </Text>

          <Slider
            style={{ flex: 1, height: 36 }}
            minimumValue={0}
            maximumValue={safeDuration}
            value={shown}
            minimumTrackTintColor={brand.orange}
            maximumTrackTintColor="rgba(255,255,255,0.35)"
            thumbTintColor={brand.orange}
            accessibilityLabel={t('player.seekForward')}
            accessibilityValue={{
              min: 0,
              max: Math.round(safeDuration),
              now: Math.round(shown),
              text: `${formatTimecode(shown)} / ${formatTimecode(safeDuration)}`,
            }}
            onSlidingStart={(v) => {
              setScrubbing(true);
              setScrubValue(v);
            }}
            onValueChange={(v) => scrubbing && setScrubValue(v)}
            onSlidingComplete={(v) => {
              setScrubbing(false);
              onSeek(v);
            }}
          />

          <Text
            variant="caption"
            className="text-white"
            forceLatin
            style={{ minWidth: 44, textAlign: 'right' }}
          >
            {formatTimecode(safeDuration)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton
            icon={muted ? 'volumeMute' : 'volume'}
            size={20}
            accessibilityLabel={muted ? t('player.unmute') : t('player.mute')}
            onPress={onToggleMute}
            color="#FFFFFF"
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('player.speed')}
            onPress={onOpenSettings}
            hitSlop={8}
            className="rounded-full bg-white/15 px-2.5 py-1"
          >
            <Text variant="caption" className="text-white" forceLatin>
              {rate}×
            </Text>
          </Pressable>

          {activeQuality ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('player.quality')}
              onPress={onOpenSettings}
              hitSlop={8}
              className="ml-2 rounded-full bg-white/15 px-2.5 py-1"
            >
              <Text variant="caption" className="text-white" forceLatin>
                {activeQuality}
              </Text>
            </Pressable>
          ) : null}

          <View style={{ flex: 1 }} />

          {hasCaptions ? (
            <IconButton
              icon="captions"
              size={20}
              accessibilityLabel={t('player.captions')}
              onPress={onOpenSettings}
              color="#FFFFFF"
            />
          ) : null}

          <IconButton
            icon="settings"
            size={20}
            accessibilityLabel={t('player.settings')}
            onPress={onOpenSettings}
            color="#FFFFFF"
          />

          <IconButton
            icon={fullscreen ? 'fullscreenExit' : 'fullscreen'}
            size={20}
            accessibilityLabel={
              fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')
            }
            onPress={onToggleFullscreen}
            color="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
}
