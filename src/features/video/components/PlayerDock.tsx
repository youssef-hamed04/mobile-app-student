import Slider from '@react-native-community/slider';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/use-translation';
import { usePlayerStore } from '@/store/player-store';
import { brand } from '@/theme/palette';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { formatTimecode } from '@/utils/format';

/** Near-black, a step lighter than the picture's letterbox so the dock reads as a panel. */
const DOCK_BACKGROUND = '#141414';
/** The mark's ink on the orange plate: the same pairing as the `highlight` button. */
const PLAY_ICON = '#1A1A1A';

export interface PlayerDockProps {
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  muted: boolean;
  hasCaptions: boolean;
  captionsOn: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekBy: (delta: number) => void;
  onToggleMute: () => void;
  onOpenSettings: (panel: 'root' | 'quality' | 'speed' | 'captions') => void;
  onToggleFullscreen: () => void;
  /** Bottom safe-area inset, so the last row clears the gesture bar. */
  bottomInset: number;
}

/**
 * The portrait control dock: a panel BELOW the video, never over it.
 *
 * In portrait the picture is a 16:9 (or source-shaped) band across the top of
 * the screen and most of the screen is empty. Floating every control on top of
 * the picture, as the fullscreen overlay does, cost picture area on a small
 * band, hid diagrams and slide text at the edges, and put the play button on
 * top of the lecturer. The dock uses the empty space instead:
 *
 *   row 1  elapsed · scrubber · total              (always LTR: media time)
 *   row 2  −10 · play/pause · +10                  (large, centred)
 *   row 3  mute · speed · quality · captions · fullscreen
 *
 * Every control is at least `MIN_TOUCH_TARGET` square. The dock does not
 * auto-hide: there is nothing underneath it to reveal.
 *
 * RTL: rows 2 and 3 are UI, so they mirror with the layout direction. Row 1 is
 * the timeline and keeps media-time orientation, the same rule as the overlay.
 */
export function PlayerDock({
  playing,
  buffering,
  position,
  duration,
  muted,
  hasCaptions,
  captionsOn,
  onPlayPause,
  onSeek,
  onSeekBy,
  onToggleMute,
  onOpenSettings,
  onToggleFullscreen,
  bottomInset,
}: PlayerDockProps) {
  const { t } = useTranslation();
  const rate = usePlayerStore((s) => s.rate);
  const preferredQuality = usePlayerStore((s) => s.preferredQuality);
  const activeQualityLabel = usePlayerStore((s) => s.activeQualityLabel);

  const [scrubbing, setScrubbing] = React.useState(false);
  const [scrubValue, setScrubValue] = React.useState(0);
  const shown = scrubbing ? scrubValue : position;
  const safeDuration = duration > 0 ? duration : 1;

  const qualityLabel =
    preferredQuality === 'auto'
      ? activeQualityLabel
        ? t('player.autoWithLevel', { level: activeQualityLabel })
        : t('player.auto')
      : preferredQuality;

  return (
    <View
      className="px-4 pt-2"
      style={{ backgroundColor: DOCK_BACKGROUND, paddingBottom: Math.max(12, bottomInset) }}
      accessibilityRole="toolbar"
    >
      {/* ---- row 1: timeline (LTR) -------------------------------------- */}
      <View style={{ direction: 'ltr', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="caption" className="text-white" forceLatin style={{ minWidth: 44 }}>
          {formatTimecode(shown)}
        </Text>
        <Slider
          style={{ flex: 1, height: MIN_TOUCH_TARGET }}
          minimumValue={0}
          maximumValue={safeDuration}
          value={shown}
          minimumTrackTintColor={brand.orange}
          maximumTrackTintColor="rgba(255,255,255,0.3)"
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
          className="text-white/80"
          forceLatin
          style={{ minWidth: 44, textAlign: 'right' }}
        >
          {formatTimecode(safeDuration)}
        </Text>
      </View>

      {/* ---- row 2: transport ------------------------------------------ */}
      <View className="mt-1 flex-row items-center justify-center" style={{ gap: 32 }}>
        <DockButton
          icon="back10"
          size={30}
          label={t('player.seekBackward')}
          onPress={() => onSeekBy(-10)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? t('player.pause') : t('player.play')}
          accessibilityState={{ busy: buffering }}
          onPress={onPlayPause}
          className="items-center justify-center rounded-full bg-highlight active:opacity-85"
          style={{ width: 64, height: 64 }}
        >
          <Icon
            name={buffering ? 'refresh' : playing ? 'pause' : 'play'}
            size={32}
            color={PLAY_ICON}
          />
        </Pressable>
        <DockButton
          icon="forward10"
          size={30}
          label={t('player.seekForward')}
          onPress={() => onSeekBy(10)}
        />
      </View>

      {/* ---- row 3: options -------------------------------------------- */}
      <View className="mt-1 flex-row items-center justify-between">
        <DockButton
          icon={muted ? 'volumeMute' : 'volume'}
          label={muted ? t('player.unmute') : t('player.mute')}
          onPress={onToggleMute}
        />
        <DockChip
          label={rate === 1 ? '1×' : `${rate}×`}
          a11y={t('player.speed')}
          onPress={() => onOpenSettings('speed')}
        />
        <DockChip
          label={qualityLabel}
          a11y={t('player.quality')}
          onPress={() => onOpenSettings('quality')}
        />
        <DockButton
          icon="captions"
          label={t('player.captions')}
          onPress={() => onOpenSettings('captions')}
          disabled={!hasCaptions}
          active={captionsOn}
        />
        <DockButton
          icon="fullscreen"
          label={t('player.fullscreen')}
          onPress={onToggleFullscreen}
        />
      </View>
    </View>
  );
}

function DockButton({
  icon,
  label,
  onPress,
  size = 24,
  disabled,
  active,
}: {
  icon: 'back10' | 'forward10' | 'volume' | 'volumeMute' | 'captions' | 'fullscreen';
  label: string;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className="items-center justify-center rounded-full active:bg-white/15"
      style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, opacity: disabled ? 0.35 : 1 }}
    >
      <Icon name={icon} size={size} color={active ? brand.orange : '#FFFFFF'} />
    </Pressable>
  );
}

function DockChip({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y}: ${label}`}
      onPress={onPress}
      className="items-center justify-center rounded-full bg-white/15 px-3 active:bg-white/25"
      style={{ height: 40, minWidth: MIN_TOUCH_TARGET, maxWidth: 140 }}
      hitSlop={4}
    >
      <Text variant="label" className="text-white" numberOfLines={1} forceLatin>
        {label}
      </Text>
    </Pressable>
  );
}
