import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { forwardChevron } from '@/i18n/direction';
import { useTheme } from '@/hooks/use-theme';
import { useLanguageStore } from '@/store/language-store';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { colors } = useTheme();
  const isRTL = useLanguageStore((s) => s.isRTL);

  return (
    <View className="mb-3 flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text variant="h3" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1} className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={10}
          className="flex-row items-center gap-0.5"
        >
          <Text variant="label" tone="primary">
            {actionLabel}
          </Text>
          <Icon name={forwardChevron(isRTL)} size={14} color={colors.primary} mirror />
        </Pressable>
      ) : null}
    </View>
  );
}
