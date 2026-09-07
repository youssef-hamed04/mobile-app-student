import * as React from 'react';
import { Pressable, Switch, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useLanguageStore } from '@/store/language-store';
import { forwardChevron } from '@/i18n/direction';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: 'default' | 'primary' | 'danger';
  /** Right-hand value text (e.g. the current setting). */
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  /** Renders a Switch instead of a chevron. */
  toggle?: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  right?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconTone = 'default',
  value,
  onPress,
  showChevron,
  toggle,
  right,
  disabled,
  destructive,
  className,
}: ListItemProps) {
  const { colors } = useTheme();
  const isRTL = useLanguageStore((s) => s.isRTL);

  const iconColor =
    destructive || iconTone === 'danger'
      ? colors.accent
      : iconTone === 'primary'
        ? colors.primary
        : colors.muted;

  const content = (
    <View
      className={cn(
        'flex-row items-center gap-3 bg-surface px-4 py-3',
        disabled && 'opacity-50',
        className
      )}
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      {icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-md bg-surface-alt">
          <Icon name={icon} size={18} color={iconColor} />
        </View>
      ) : null}

      <View className="flex-1">
        <Text variant="body" tone={destructive ? 'accent' : 'default'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2} className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text variant="caption" tone="muted" numberOfLines={1} className="max-w-[40%]">
          {value}
        </Text>
      ) : null}

      {right}

      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled || disabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.border}
        />
      ) : null}

      {showChevron && !toggle ? (
        <Icon name={forwardChevron(isRTL)} size={18} color={colors.subtle} />
      ) : null}
    </View>
  );

  if (!onPress || toggle) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityValue={value ? { text: value } : undefined}
      disabled={disabled}
      onPress={onPress}
      className="active:bg-surface-alt"
    >
      {content}
    </Pressable>
  );
}

export function ListSection({
  title,
  children,
  footer,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <View className="mb-6">
      {title ? (
        <Text variant="overline" tone="subtle" className="mb-2 px-4">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-lg border border-border">
        {React.Children.toArray(children).map((child, i) => (
          <View key={i}>
            {i > 0 ? <View className="ms-4 h-px bg-border" /> : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" tone="subtle" className="mt-2 px-4">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
