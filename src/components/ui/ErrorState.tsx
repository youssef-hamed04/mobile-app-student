import * as React from 'react';
import { View } from 'react-native';

import { ApiError, asApiError } from '@/api/errors';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { isDev } from '@/config/env';
import { cn } from '@/utils/cn';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const ICON_FOR: Partial<Record<ApiError['code'], IconName>> = {
  NETWORK_OFFLINE: 'wifiOff',
  NETWORK_TIMEOUT: 'wifiOff',
  DEVICE_NOT_AUTHORIZED: 'device',
  DEVICE_LIMIT_REACHED: 'device',
  DEVICE_CHANGE_PENDING: 'device',
  DEVICE_INTEGRITY_FAILED: 'shieldAlert',
  ACCESS_EXPIRED: 'clock',
  COURSE_ARCHIVED: 'archive',
  NOT_ENROLLED: 'lock',
  PAYMENT_REQUIRED: 'price',
  FORBIDDEN: 'lock',
  CAPTURE_DETECTED: 'shieldAlert',
  PLAYBACK_DENIED: 'lock',
};

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Renders a *student-facing* error.
 *
 * The rule enforced here: the message always comes from the i18n bundle keyed
 * by the machine-readable error code. The server's own `message` is developer
 * text and is only shown in development builds.
 */
export function ErrorState({
  error,
  onRetry,
  onSecondary,
  secondaryLabel,
  compact = false,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const apiError = asApiError(error);
  const icon = ICON_FOR[apiError.code] ?? 'error';
  const message = t(apiError.i18nKey, { defaultValue: t('errors.genericBody') });
  const showRetry = onRetry && apiError.retryable;

  return (
    <View
      accessible
      accessibilityRole="alert"
      className={cn('items-center justify-center px-6', compact ? 'py-8' : 'py-14', className)}
    >
      <View
        className="mb-4 items-center justify-center rounded-full bg-accent-soft"
        style={{ width: compact ? 52 : 68, height: compact ? 52 : 68 }}
      >
        <Icon name={icon} size={compact ? 24 : 30} color={colors.accent} />
      </View>

      <Text variant={compact ? 'title' : 'h3'} className="text-center">
        {t('errors.title')}
      </Text>

      <Text variant="caption" tone="muted" className="mt-2 max-w-[320px] text-center">
        {message}
      </Text>

      {isDev ? (
        <Text variant="caption" tone="subtle" className="mt-3 text-center" forceLatin>
          {apiError.code}
          {apiError.requestId ? ` · ${apiError.requestId}` : ''}
          {`\n${apiError.message}`}
        </Text>
      ) : null}

      <View className="mt-5 flex-row gap-2">
        {showRetry ? <Button label={t('common.retry')} onPress={onRetry} /> : null}
        {onSecondary && secondaryLabel ? (
          <Button label={secondaryLabel} variant="secondary" onPress={onSecondary} />
        ) : null}
      </View>
    </View>
  );
}

/** Inline variant for form-level and card-level failures. */
export function InlineError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const apiError = asApiError(error);

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-md border border-accent/30 bg-accent-soft p-3"
    >
      <Icon name="error" size={18} color={colors.accent} />
      <Text variant="caption" tone="accent" className="flex-1">
        {t(apiError.i18nKey, { defaultValue: t('errors.genericBody') })}
      </Text>
    </View>
  );
}
