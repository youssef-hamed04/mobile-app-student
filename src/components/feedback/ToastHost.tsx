import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { type Toast, useUIStore } from '@/store/ui-store';
import { zIndex } from '@/theme/tokens';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from '../ui/Icon';
import { Text } from '../ui/Text';

const ICONS: Record<Toast['variant'], IconName> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

const STYLES: Record<Toast['variant'], string> = {
  info: 'bg-surface-raised border-border',
  success: 'bg-surface-raised border-success/40',
  warning: 'bg-surface-raised border-warning/40',
  error: 'bg-surface-raised border-accent/50',
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useUIStore((s) => s.dismissToast);
  const { colors } = useTheme();

  React.useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(id);
  }, [toast.id, toast.durationMs, dismiss]);

  const tint =
    toast.variant === 'error'
      ? colors.accent
      : toast.variant === 'success'
        ? colors.success
        : toast.variant === 'warning'
          ? colors.warning
          : colors.info;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(160)}
      layout={Layout.springify()}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={() => dismiss(toast.id)}
        className={cn(
          'mb-2 flex-row items-center gap-3 rounded-md border px-3 py-3 shadow-lg',
          STYLES[toast.variant]
        )}
      >
        <Icon name={ICONS[toast.variant]} size={20} color={tint} />
        <Text variant="caption" className="flex-1">
          {toast.message}
        </Text>
        {toast.actionLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.onAction?.();
              dismiss(toast.id);
            }}
            hitSlop={8}
          >
            <Text variant="label" tone="primary">
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 px-4"
      style={{ paddingBottom: insets.bottom + 12, zIndex: zIndex.toast }}
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </View>
  );
}
