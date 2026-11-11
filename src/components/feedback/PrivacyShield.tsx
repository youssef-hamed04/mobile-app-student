import { BlurView } from 'expo-blur';
import * as React from 'react';
import { Platform, View } from 'react-native';

import { useProtectionState } from '@/hooks/use-content-protection';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { ProtectionState } from '@/services/content-protection';
import { useUIStore } from '@/store/ui-store';
import { zIndex } from '@/theme/tokens';
import { setPrivacyOverlayText } from '@modules/content-protection';

import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';

/**
 * iOS has no window-level secure flag: only SecureContentView regions come out
 * blank in a recording or AirPlay mirror, so every other screen is covered for
 * as long as the capture lasts. Android needs no app-wide cover: FLAG_SECURE
 * already blanks the whole window in recordings and refuses non-secure
 * displays.
 */
export function coversForCapture(
  os: string,
  state: Pick<ProtectionState, 'recording' | 'externalDisplay'>
): boolean {
  return os === 'ios' && (state.recording || state.externalDisplay);
}

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
  const requested = useUIStore((s) => s.privacyShield);
  const requestedReason = useUIStore((s) => s.shieldReason);
  const protection = useProtectionState();
  const { t } = useTranslation();
  const { colors } = useTheme();

  // The app-switcher overlay is native (iOS); keep its text in the app's language.
  const overlayText = t('release.protectedContent');
  React.useEffect(() => {
    setPrivacyOverlayText(overlayText);
  }, [overlayText]);

  const capturing = coversForCapture(Platform.OS, protection);

  const visible = requested || capturing;
  const reason = capturing ? 'recording' : requestedReason;

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
