import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stagingUsesProductionApi } from '@/config/env';
import { useTranslation } from '@/hooks/use-translation';

import { Text } from '../ui/Text';

/**
 * Owner decision D7: a staging build uses the PRODUCTION API, because no
 * staging backend exists. Anyone testing it is working with real students'
 * data, so the build says so on every screen. It never renders in a
 * production or development build, and it does not take touches.
 */
export function StagingBanner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  if (!stagingUsesProductionApi) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      style={{ position: 'absolute', top: insets.top, left: 0, right: 0, alignItems: 'center', zIndex: 1000 }}
    >
      <View className="rounded-b-md bg-danger-600 px-3 py-0.5">
        <Text variant="caption" className="text-white">
          {t('staging.productionApiBadge')}
        </Text>
      </View>
    </View>
  );
}
