import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { brand } from '@/theme/palette';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant =
  | 'primary'
  /** The brand mark's plate: orange fill, black ink, heavy rule. */
  | 'highlight'
  /**
   * The inverse pair, for a button sitting *on* the plate: the mark's red
   * fill with a white label. Fixed in both themes, because the surface it is
   * made for is fixed too. The rule is not decoration — red on orange is only
   * 2.8:1, so without it the button would have no legible edge.
   */
  | 'onPlate'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:opacity-85',
  highlight: 'bg-highlight border-2 border-outline active:opacity-85',
  onPlate: 'bg-danger-500 border-2 border-outline active:opacity-85',
  secondary: 'bg-surface-alt border border-border active:bg-surface-raised',
  outline: 'border-2 border-primary bg-transparent active:bg-primary-soft',
  ghost: 'bg-transparent active:bg-surface-alt',
  danger: 'bg-accent active:opacity-85',
  link: 'bg-transparent',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-primary-fg',
  highlight: 'text-highlight-fg',
  onPlate: 'text-ink-0',
  secondary: 'text-foreground',
  outline: 'text-primary',
  ghost: 'text-foreground',
  danger: 'text-accent-fg',
  link: 'text-primary underline',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 px-3.5 rounded-md gap-1.5',
  md: 'h-12 px-5 rounded-md gap-2',
  lg: 'h-14 px-6 rounded-lg gap-2',
};

const TEXT_SIZE: Record<ButtonSize, 'caption' | 'label' | 'bodyStrong'> = {
  sm: 'label',
  md: 'bodyStrong',
  lg: 'bodyStrong',
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Icon placed at the *start* of the label — flips with RTL automatically. */
  iconStart?: IconName;
  iconEnd?: IconName;
  fullWidth?: boolean;
  className?: string;
  /** Overrides the label for screen readers when the label is an abbreviation. */
  accessibilityLabel?: string;
}

/**
 * Primary action component.
 *
 * Accessibility notes baked in:
 *  - minimum 48dp touch target enforced via `hitSlop` on the small size
 *  - `accessibilityState.busy` while loading, so VoiceOver/TalkBack announce it
 *  - the label stays mounted while loading (opacity 0) so the button does not
 *    resize mid-press, which is a common cause of mis-taps.
 */
export const Button = React.forwardRef<View, ButtonProps>(function Button(
  {
    label,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    iconStart,
    iconEnd,
    fullWidth = false,
    className,
    accessibilityLabel,
    ...rest
  },
  ref
) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const spinnerColor =
    variant === 'primary'
      ? colors.primaryFg
      : variant === 'highlight'
        ? colors.highlightFg
        : variant === 'danger'
          ? colors.accentFg
          : variant === 'onPlate'
            ? brand.white
            : colors.primary;

  const iconColor =
    variant === 'primary'
      ? colors.primaryFg
      : variant === 'highlight'
        ? colors.highlightFg
        : variant === 'danger'
          ? colors.accentFg
          : variant === 'onPlate'
            ? brand.white
            : variant === 'outline' || variant === 'link'
              ? colors.primary
              : colors.foreground;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 8 : 0}
      className={cn(
        'flex-row items-center justify-center',
        CONTAINER[variant],
        SIZE[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className
      )}
      style={size === 'sm' ? { minHeight: MIN_TOUCH_TARGET - 8 } : undefined}
      {...rest}
    >
      {loading ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="small" color={spinnerColor} />
        </View>
      ) : null}

      <View
        className={cn('flex-row items-center justify-center gap-2', loading && 'opacity-0')}
      >
        {iconStart ? <Icon name={iconStart} size={18} color={iconColor} mirror /> : null}
        <Text variant={TEXT_SIZE[size]} className={LABEL[variant]} numberOfLines={1}>
          {label}
        </Text>
        {iconEnd ? <Icon name={iconEnd} size={18} color={iconColor} mirror /> : null}
      </View>
    </Pressable>
  );
});

/** Circular icon-only button — used in the player and app bars. */
export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconName;
  size?: number;
  color?: string;
  variant?: 'plain' | 'filled' | 'glass';
  accessibilityLabel: string;
  className?: string;
  mirror?: boolean;
}

export const IconButton = React.forwardRef<View, IconButtonProps>(
  function IconButton(
    {
      icon,
      size = 22,
      color,
      variant = 'plain',
      accessibilityLabel,
      className,
      mirror = false,
      disabled,
      ...rest
    },
    ref
  ) {
    const { colors } = useTheme();

    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        hitSlop={12}
        className={cn(
          'items-center justify-center rounded-full',
          variant === 'filled' && 'bg-surface-alt',
          variant === 'glass' && 'bg-black/45',
          disabled && 'opacity-40',
          className
        )}
        style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
        {...rest}
      >
        <Icon
          name={icon}
          size={size}
          color={color ?? (variant === 'glass' ? '#FFFFFF' : colors.foreground)}
          mirror={mirror}
        />
      </Pressable>
    );
  }
);
