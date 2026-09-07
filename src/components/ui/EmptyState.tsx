import * as React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/utils/cn';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
  className?: string;
}

/**
 * Every empty state answers two questions: what happened, and what can I do
 * next. The action is therefore part of the component's contract rather than
 * something each screen bolts on.
 */
export function EmptyState({
  icon = 'empty',
  title,
  body,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  className,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${title}${body ? `. ${body}` : ''}`}
      className={cn(
        'items-center justify-center px-6',
        compact ? 'py-8' : 'py-16',
        className
      )}
    >
      <View
        className="mb-4 items-center justify-center rounded-full bg-surface-alt"
        style={{ width: compact ? 56 : 72, height: compact ? 56 : 72 }}
      >
        <Icon name={icon} size={compact ? 26 : 32} color={colors.subtle} />
      </View>

      <Text variant={compact ? 'title' : 'h3'} className="text-center">
        {title}
      </Text>

      {body ? (
        <Text variant="caption" tone="muted" className="mt-2 max-w-[300px] text-center">
          {body}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-5" size="md" />
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <Button
          label={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="link"
          className="mt-1"
          size="sm"
        />
      ) : null}
    </View>
  );
}
