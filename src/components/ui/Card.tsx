import * as React from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

import { cn } from '@/utils/cn';

export type CardVariant = 'default' | 'plate';

export interface CardProps extends ViewProps {
  /** Elevated cards read as "raised" in dark mode via surface-raised. */
  elevated?: boolean;
  /**
   * `plate` draws the heavy near-black rule from the brand mark. Reserve it
   * for hero surfaces (promotions, the active item in a list) — used
   * everywhere it stops reading as emphasis.
   */
  variant?: CardVariant;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

/**
 * Surface container.
 *
 * In light mode depth comes from a border + subtle shadow; in dark mode
 * shadows are invisible, so depth comes from a lighter surface tone instead.
 * That is why `elevated` swaps the background rather than the shadow.
 *
 * Following the brand mark, the edge does the work: cards sit on the warm
 * paper ground with a defined rule rather than dissolving into a soft blur.
 */
export function Card({
  elevated = false,
  variant = 'default',
  onPress,
  disabled,
  className,
  children,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const classes = cn(
    'rounded-lg overflow-hidden',
    variant === 'plate'
      ? 'border-2 border-outline dark:border-border-strong'
      : 'border border-border',
    elevated ? 'bg-surface-raised' : 'bg-surface',
    'shadow-sm',
    disabled && 'opacity-60',
    className
  );

  if (!onPress) {
    return (
      <View className={classes} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(classes, 'active:opacity-80')}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export function CardBody({ className, ...rest }: ViewProps & { className?: string }) {
  return <View className={cn('p-4', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('border-t border-border px-4 py-3', className)}
      {...rest}
    />
  );
}
