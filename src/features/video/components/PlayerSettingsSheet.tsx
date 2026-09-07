import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import {
  PLAYBACK_RATES,
  type PlaybackRate,
  type QualityLevel,
  usePlayerStore,
} from '@/store/player-store';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { CaptionTrack } from '@/types/domain';
import { cn } from '@/utils/cn';

export interface PlayerSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Ladder actually available for this asset, from the playback ticket. */
  availableQualities: string[];
  captions: CaptionTrack[];
  activeCaption: string | null;
  onSelectCaption: (language: string | null) => void;
  /** Reloads the stream at the chosen ceiling. */
  onSelectQuality: (quality: QualityLevel) => void;
  autoQualityLabel: string | null;
}

type Panel = 'root' | 'quality' | 'speed' | 'captions';

/**
 * Quality / speed / captions.
 *
 * Quality selection is a *server-side* operation: the chosen ceiling is sent
 * back with the manifest request so the backend prunes the ABR ladder and
 * issues a new signed URL. Doing it that way (rather than pinning a rendition
 * client-side) means the ladder, and therefore the bitrate the CDN serves,
 * stays under the platform's control — a client cannot ask for a rendition it
 * was never authorized for.
 */
export function PlayerSettingsSheet({
  visible,
  onClose,
  availableQualities,
  captions,
  activeCaption,
  onSelectCaption,
  onSelectQuality,
  autoQualityLabel,
}: PlayerSettingsSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [panel, setPanel] = React.useState<Panel>('root');

  const rate = usePlayerStore((s) => s.rate);
  const setRate = usePlayerStore((s) => s.setRate);
  const preferredQuality = usePlayerStore((s) => s.preferredQuality);
  const setPreferredQuality = usePlayerStore((s) => s.setPreferredQuality);

  React.useEffect(() => {
    if (!visible) setPanel('root');
  }, [visible]);

  const qualityOptions: QualityLevel[] = React.useMemo(() => {
    const ordered: QualityLevel[] = ['1080p', '720p', '480p', '360p'];
    return ['auto', ...ordered.filter((q) => availableQualities.includes(q))];
  }, [availableQualities]);

  const qualityLabel =
    preferredQuality === 'auto'
      ? autoQualityLabel
        ? t('player.autoWithLevel', { level: autoQualityLabel })
        : t('player.auto')
      : preferredQuality;

  const captionLabel =
    captions.find((c) => c.language === activeCaption)?.label ?? t('player.captionsOff');

  const title =
    panel === 'quality'
      ? t('player.quality')
      : panel === 'speed'
        ? t('player.speed')
        : panel === 'captions'
          ? t('player.captions')
          : t('player.settings');

  return (
    <Sheet visible={visible} onClose={onClose} title={title} maxHeightRatio={0.7}>
      {panel === 'root' ? (
        <View className="pb-2">
          <Row
            icon="quality"
            label={t('player.quality')}
            value={qualityLabel ?? t('player.auto')}
            onPress={() => setPanel('quality')}
          />
          <Row
            icon="speed"
            label={t('player.speed')}
            value={rate === 1 ? t('player.normalSpeed') : `${rate}×`}
            onPress={() => setPanel('speed')}
          />
          <Row
            icon="captions"
            label={t('player.captions')}
            value={captions.length === 0 ? t('player.noCaptions') : captionLabel}
            onPress={() => captions.length > 0 && setPanel('captions')}
            disabled={captions.length === 0}
          />
        </View>
      ) : null}

      {panel === 'quality' ? (
        <View className="pb-2">
          {qualityOptions.map((q) => (
            <Option
              key={q}
              label={
                q === 'auto'
                  ? autoQualityLabel
                    ? t('player.autoWithLevel', { level: autoQualityLabel })
                    : t('player.auto')
                  : q
              }
              selected={preferredQuality === q}
              onPress={() => {
                setPreferredQuality(q);
                onSelectQuality(q);
                onClose();
              }}
            />
          ))}
        </View>
      ) : null}

      {panel === 'speed' ? (
        <View className="pb-2">
          {PLAYBACK_RATES.map((r) => (
            <Option
              key={r}
              label={r === 1 ? t('player.normalSpeed') : `${r}×`}
              selected={rate === r}
              onPress={() => {
                setRate(r as PlaybackRate);
                onClose();
              }}
            />
          ))}
        </View>
      ) : null}

      {panel === 'captions' ? (
        <View className="pb-2">
          <Option
            label={t('player.captionsOff')}
            selected={activeCaption === null}
            onPress={() => {
              onSelectCaption(null);
              onClose();
            }}
          />
          {captions.map((c) => (
            <Option
              key={c.language}
              label={c.label}
              selected={activeCaption === c.language}
              onPress={() => {
                onSelectCaption(c.language);
                onClose();
              }}
            />
          ))}
        </View>
      ) : null}

      {panel !== 'root' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPanel('root')}
          className="mt-2 flex-row items-center justify-center gap-1 py-3"
        >
          <Icon name="chevron-left" size={16} color={colors.muted} mirror />
          <Text variant="label" tone="muted">
            {t('common.back')}
          </Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  disabled,
}: {
  icon: 'quality' | 'speed' | 'captions';
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-md px-2 py-3.5 active:bg-surface-alt',
        disabled && 'opacity-45'
      )}
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Icon name={icon} size={19} color={colors.muted} />
      <Text variant="body" className="flex-1">
        {label}
      </Text>
      <Text variant="caption" tone="muted">
        {value}
      </Text>
      <Icon name="chevron-right" size={16} color={colors.subtle} mirror />
    </Pressable>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-md px-2 py-3.5 active:bg-surface-alt"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Text variant="body" tone={selected ? 'primary' : 'default'} className="flex-1">
        {label}
      </Text>
      {selected ? <Icon name="check" size={19} color={colors.primary} /> : null}
    </Pressable>
  );
}
