import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/utils/cn';

import { IconButton } from './Button';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Caps the sheet height as a fraction of the screen. */
  maxHeightRatio?: number;
  scrollable?: boolean;
  footer?: React.ReactNode;
}

/**
 * Bottom sheet built on the platform Modal.
 *
 * Chosen over a gesture-driven sheet library deliberately: the sheet is used
 * for quality/speed pickers *inside the protected player*, where an extra
 * gesture handler layer competes with the player's own tap-to-toggle-controls
 * handling. A Modal is also automatically announced and focus-trapped by both
 * screen readers.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.8,
  scrollable = true,
  footer,
}: SheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const Body = scrollable ? ScrollView : View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      // Protected screens keep FLAG_SECURE at the window level, which covers
      // modals too on Android; on iOS the secure surface is per-view, so
      // sheets never render protected media.
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.closeSheet')}
          onPress={onClose}
          className="absolute inset-0 bg-overlay/60"
        />

        <View
          className="rounded-t-2xl border-t border-border bg-surface"
          style={{ maxHeight: `${maxHeightRatio * 100}%`, paddingBottom: insets.bottom + 12 }}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-border-strong" />
          </View>

          {title ? (
            <View className="flex-row items-start gap-2 px-4 pb-2 pt-3">
              <View className="flex-1">
                <Text variant="title">{title}</Text>
                {subtitle ? (
                  <Text variant="caption" tone="muted" className="mt-1">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton
                icon="close"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
              />
            </View>
          ) : null}

          <Body
            className={cn(scrollable && 'grow-0')}
            contentContainerClassName={scrollable ? 'px-4 pb-2' : undefined}
            showsVerticalScrollIndicator={false}
          >
            {scrollable ? children : <View className="px-4 pb-2">{children}</View>}
          </Body>

          {footer ? <View className="border-t border-border px-4 pt-3">{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
