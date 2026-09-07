import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/utils/cn';

import { Text } from './Text';

export interface SpinnerProps {
  size?: 'small' | 'large';
  label?: string;
  /** Fills the parent and centres — used for full-screen route loading. */
  fullscreen?: boolean;
  className?: string;
}

export function Spinner({ size = 'large', label, fullscreen, className }: SpinnerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t('common.loading')}
      className={cn(
        'items-center justify-center gap-3',
        fullscreen && 'flex-1 bg-background',
        className
      )}
    >
      <ActivityIndicator size={size} color={colors.primary} />
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
