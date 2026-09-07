import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  onRemove?: () => void;
  removeAccessibilityLabel?: string;
  disabled?: boolean;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  onRemove,
  removeAccessibilityLabel,
  disabled,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        'h-9 flex-row items-center gap-1.5 rounded-full border px-3',
        selected
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-surface active:bg-surface-alt',
        disabled && 'opacity-50'
      )}
    >
      {icon ? (
        <Icon
          name={icon}
          size={14}
          color={selected ? colors.primary : colors.muted}
        />
      ) : null}

      <Text variant="caption" tone={selected ? 'primary' : 'default'} numberOfLines={1}>
        {label}
      </Text>

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={removeAccessibilityLabel ?? label}
        >
          <Icon name="close" size={14} color={selected ? colors.primary : colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
      // The scroll view itself flips with the layout, so no manual RTL work.
    >
      <View className="flex-row gap-2">{children}</View>
    </ScrollView>
  );
}
