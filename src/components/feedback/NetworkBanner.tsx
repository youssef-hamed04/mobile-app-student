import * as React from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { useNetwork } from '@/hooks/use-network';
import { useTranslation } from '@/hooks/use-translation';

import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';

/**
 * Persistent offline indicator.
 *
 * Only shown when we are *confident* the device is offline (`isConnected` is
 * false, or reachability probing explicitly failed). NetInfo reports
 * `isInternetReachable: null` while it is still probing, and treating that as
 * offline produces a banner flash on every cold start.
 */
export function NetworkBanner() {
  const { connected, reachable, slow } = useNetwork();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const offline = !connected || reachable === false;
  if (!offline && !slow) return null;

  return (
    <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(150)}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className={
          offline
            ? 'flex-row items-center gap-2 bg-accent px-4 py-2'
            : 'flex-row items-center gap-2 bg-warning/20 px-4 py-2'
        }
      >
        <Icon
          name="wifiOff"
          size={16}
          color={offline ? colors.accentFg : colors.warning}
        />
        <Text
          variant="caption"
          className={offline ? 'flex-1 text-accent-fg' : 'flex-1 text-warning'}
        >
          {offline ? t('network.offlineBanner') : t('network.slowConnection')}
        </Text>
      </View>
    </Animated.View>
  );
}
