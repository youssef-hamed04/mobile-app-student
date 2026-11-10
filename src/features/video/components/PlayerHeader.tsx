import * as React from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/use-translation';
import { brand } from '@/theme/palette';

export interface PlayerHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Top safe-area inset, so the row clears the status bar / notch. */
  topInset: number;
}

/**
 * The portrait header: close, lesson title and the protected-content badge,
 * on its own row ABOVE the picture. In fullscreen the same information is an
 * auto-hiding overlay (PlayerControls); in portrait there is room for it to
 * stay put and never cover the lecture. Mirrors in RTL.
 */
export function PlayerHeader({ title, subtitle, onClose, topInset }: PlayerHeaderProps) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-row items-center gap-2 bg-black px-2 pb-1"
      style={{ paddingTop: Math.max(4, topInset) }}
    >
      <IconButton
        icon="close"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        variant="plain"
        color="#FFFFFF"
      />
      <View className="flex-1">
        <Text variant="label" className="text-white" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" className="text-white/60" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        className="flex-row items-center gap-1 rounded-full bg-white/10 px-2 py-1"
        accessibilityLabel={t('player.protectedNotice')}
      >
        <Icon name="shield" size={12} color={brand.orange} />
      </View>
    </View>
  );
}
