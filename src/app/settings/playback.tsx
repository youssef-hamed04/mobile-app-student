import * as React from 'react';

import { AppBar } from '@/components/layout/AppBar';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/hooks/use-translation';
import {
  PLAYBACK_RATES,
  QUALITY_LEVELS,
  type PlaybackRate,
  type QualityLevel,
  usePlayerStore,
} from '@/store/player-store';
import { View } from 'react-native';

export default function PlaybackSettingsScreen() {
  const { t } = useTranslation();

  const preferredQuality = usePlayerStore((s) => s.preferredQuality);
  const setPreferredQuality = usePlayerStore((s) => s.setPreferredQuality);
  const rate = usePlayerStore((s) => s.rate);
  const setRate = usePlayerStore((s) => s.setRate);
  const autoplayNext = usePlayerStore((s) => s.autoplayNext);
  const setAutoplayNext = usePlayerStore((s) => s.setAutoplayNext);
  const captionsEnabled = usePlayerStore((s) => s.captionsEnabled);
  const setCaptionsEnabled = usePlayerStore((s) => s.setCaptionsEnabled);
  const dataSaver = usePlayerStore((s) => s.dataSaver);
  const setDataSaver = usePlayerStore((s) => s.setDataSaver);

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('settings.playback')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-4">
        <View className="mb-6 gap-4">
          <Select
            label={t('settings.defaultQuality')}
            value={preferredQuality}
            options={QUALITY_LEVELS.map((q) => ({
              value: q,
              label: q === 'auto' ? t('player.auto') : q,
            }))}
            onChange={(v) => setPreferredQuality(v as QualityLevel)}
          />

          <Select
            label={t('settings.defaultSpeed')}
            value={String(rate)}
            options={PLAYBACK_RATES.map((r) => ({
              value: String(r),
              label: r === 1 ? t('player.normalSpeed') : `${r}×`,
            }))}
            onChange={(v) => setRate(Number(v) as PlaybackRate)}
          />
        </View>

        <ListSection footer={t('settings.dataSaverBody')}>
          <ListItem
            icon="play"
            title={t('settings.autoplayNext')}
            toggle={{ value: autoplayNext, onChange: setAutoplayNext }}
          />
          <ListItem
            icon="captions"
            title={t('settings.captionsDefault')}
            toggle={{ value: captionsEnabled, onChange: setCaptionsEnabled }}
          />
          <ListItem
            icon="wifiOff"
            title={t('settings.dataSaver')}
            toggle={{ value: dataSaver, onChange: setDataSaver }}
          />
        </ListSection>
      </Screen>
    </Screen>
  );
}
