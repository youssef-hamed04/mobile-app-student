import { BlurView } from 'expo-blur';
import * as React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useUIStore } from '@/store/ui-store';
import { zIndex } from '@/theme/tokens';

import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';

/**
 * Opaque overlay raised over the whole app when protected content must not be
 * visible: the app is backgrounded, a screenshot was just taken, or a screen
 * recording is running.
 *
 * It is rendered at the root (above every navigator) at the highest z-index so
 * nothing — including modals and the fullscreen player — can appear over it.
 * It is intentionally *opaque* rather than blurred: a blur still leaks layout
 * and colour information into a recording.
 */
export function PrivacyShield() {
  const visible = useUIStore((s) => s.privacyShield);
  const reason = useUIStore((s) => s.shieldReason);
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!visible) return null;

  const title =
    reason === 'capture' || reason === 'recording'
      ? t('player.captureBlockedTitle')
      : t('security.shieldTitle');

  const body =
    reason === 'capture' || reason === 'recording'
      ? t('player.captureBlockedBody')
      : t('security.shieldBody');

  return (
    <View
      accessibilityViewIsModal
      accessibilityRole="alert"
      pointerEvents="auto"
      className="absolute inset-0 items-center justify-center bg-background px-8"
      style={{ zIndex: zIndex.shield, elevation: zIndex.shield }}
    >
      {/* The blur sits *under* the opaque background purely as a visual
          flourish for the background case; it never reveals content. */}
      <BlurView intensity={40} tint="dark" className="absolute inset-0" />

      <View className="items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <Icon name="shield" size={30} color={colors.primary} />
        </View>
        <Text variant="h3" className="text-center">
          {title}
        </Text>
        <Text variant="caption" tone="muted" className="mt-2 max-w-[300px] text-center">
          {body}
        </Text>
      </View>
    </View>
  );
}
