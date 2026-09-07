import * as React from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

import { cn } from '@/utils/cn';

export interface CardProps extends ViewProps {
  /** Elevated cards read as "raised" in dark mode via surface-raised. */
  elevated?: boolean;
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
 */
export function Card({
  elevated = false,
  onPress,
  disabled,
  className,
  children,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const classes = cn(
    'rounded-lg border border-border overflow-hidden',
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
