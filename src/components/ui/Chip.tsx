import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { brand } from '@/theme/palette';
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
  /**
   * On the brand plate. A white pill is 1.8:1 there and the selected cream is
   * worse, so selection is carried by the mark's red fill instead of a tint,
   * and both states get the plate's hard rule.
   */
  onPlate?: boolean;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  onRemove,
  removeAccessibilityLabel,
  disabled,
  onPlate = false,
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
        onPlate
          ? selected
            ? 'border-2 border-outline bg-danger-500'
            : 'border-2 border-outline bg-surface active:bg-surface-alt'
          : selected
            ? 'border-primary bg-primary-soft'
            : 'border-border bg-surface active:bg-surface-alt',
        disabled && 'opacity-50'
      )}
    >
      {icon ? (
        <Icon
          name={icon}
          size={14}
          color={
            onPlate && selected
              ? brand.white
              : selected
                ? colors.primary
                : colors.muted
          }
        />
      ) : null}

      <Text
        variant="caption"
        tone={onPlate && selected ? undefined : selected ? 'primary' : 'default'}
        className={onPlate && selected ? 'text-ink-0' : undefined}
        numberOfLines={1}
      >
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
