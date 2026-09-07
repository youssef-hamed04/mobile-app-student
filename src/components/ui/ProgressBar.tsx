import * as React from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/hooks/use-translation';
import { clamp } from '@/utils/guards';
import { cn } from '@/utils/cn';

import { Text } from './Text';

export interface ProgressBarProps {
  /** 0..100 */
  percent: number;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  tone?: 'primary' | 'success';
  className?: string;
}

export function ProgressBar({
  percent,
  size = 'sm',
  showLabel = false,
  tone = 'primary',
  className,
}: ProgressBarProps) {
  const { t } = useTranslation();
  const value = clamp(Math.round(percent || 0), 0, 100);

  const height = size === 'xs' ? 4 : size === 'sm' ? 6 : 10;
  const fill = tone === 'success' ? 'bg-success' : 'bg-primary';

  return (
    <View className={cn('gap-1', className)}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('a11y.progressBar', { percent: value })}
        accessibilityValue={{ min: 0, max: 100, now: value }}
        className="w-full overflow-hidden rounded-full bg-surface-alt"
        style={{ height }}
      >
        {/* Width percentage is direction-agnostic: the track fills from the
            start edge in both LTR and RTL because the row itself flips. */}
        <View className={cn('h-full rounded-full', fill)} style={{ width: `${value}%` }} />
      </View>

      {showLabel ? (
        <Text variant="caption" tone="muted">
          {t('common.percentComplete', { percent: value })}
        </Text>
      ) : null}
    </View>
  );
}
