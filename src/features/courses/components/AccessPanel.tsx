import * as React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { CourseDetail } from '@/types/domain';
import { formatDate, formatMoney } from '@/utils/format';

import { courseAccessFlags } from '../hooks';

export interface AccessPanelProps {
  course: CourseDetail;
  onJoin: () => void;
  onContinue: () => void;
  onContactAdmin: () => void;
  joining?: boolean;
}

/**
 * The one place that decides what a student can do with a course.
 *
 * Every access state maps to exactly one primary action, so there is never a
 * screen where "Join" and "Continue" are both plausible. The states come from
 * the server; nothing here infers access from, say, the presence of lessons.
 */
export function AccessPanel({
  course,
  onJoin,
  onContinue,
  onContactAdmin,
  joining,
}: AccessPanelProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();

  const flags = courseAccessFlags(course);
  const price = formatMoney(course.price, language);

  // ---- terminal states: explain, then offer the human escape hatch ------
  if (flags.isArchived) {
    return (
      <Notice
        icon="archive"
        tone="neutral"
        title={t('access.archivedTitle')}
        body={t('access.archivedBody')}
        actionLabel={t('settings.contactSupport')}
        onAction={onContactAdmin}
      />
    );
  }

  if (flags.isExpired) {
    return (
      <Notice
        icon="clock"
        tone="danger"
        title={t('access.expiredTitle')}
        body={t('access.expiredBody')}
        actionLabel={
          course.access.availableMethods.length > 0
            ? t('access.joinNow')
            : t('settings.contactSupport')
        }
        onAction={course.access.availableMethods.length > 0 ? onJoin : onContactAdmin}
      />
    );
  }

  if (flags.isRevoked) {
    return (
      <Notice
        icon="shieldAlert"
        tone="danger"
        title={t('access.revoked')}
        body={t('access.expiredBody')}
        actionLabel={t('settings.contactSupport')}
        onAction={onContactAdmin}
      />
    );
  }

  if (course.access.state === 'PENDING_APPROVAL') {
    return (
      <Notice
        icon="clock"
        tone="warning"
        title={t('access.pendingTitle')}
        body={t('access.pendingBody')}
      />
    );
  }

  if (course.access.state === 'PENDING_PAYMENT') {
    return (
      <Notice
        icon="price"
        tone="warning"
        title={t('access.paymentPendingTitle')}
        body={t('access.paymentPendingBody')}
        actionLabel={t('access.joinNow')}
        onAction={onJoin}
      />
    );
  }

  // ---- enrolled --------------------------------------------------------
  if (flags.hasAccess) {
    const started = (course.progress?.percent ?? 0) > 0;
    return (
      <View className="gap-2">
        <Button
          label={started ? t('courses.continueCourse') : t('courses.startCourse')}
          onPress={onContinue}
          size="lg"
          fullWidth
          iconStart="play"
        />
        <Text variant="caption" tone="muted" className="text-center">
          {course.access.expiresAt
            ? t('access.expiresOn', {
                date: formatDate(course.access.expiresAt, language),
              })
            : t('access.lifetimeAccess')}
        </Text>
      </View>
    );
  }

  // ---- not enrolled ----------------------------------------------------
  return (
    <View className="gap-2">
      <Button
        label={
          course.isFree
            ? t('access.joinFree')
            : price
              ? t('access.buyFor', { price })
              : t('access.joinNow')
        }
        onPress={onJoin}
        loading={joining}
        size="lg"
        fullWidth
        disabled={!flags.canJoin}
      />
      <View className="flex-row items-center justify-center gap-1.5">
        <Icon name="shield" size={13} color={colors.subtle} />
        <Text variant="caption" tone="subtle">
          {t('security.protectedContentTitle')}
        </Text>
      </View>
    </View>
  );
}

function Notice({
  icon,
  tone,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  tone: 'neutral' | 'warning' | 'danger';
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();

  const border =
    tone === 'danger'
      ? 'border-accent/40 bg-accent-soft'
      : tone === 'warning'
        ? 'border-warning/40 bg-warning/10'
        : 'border-border bg-surface-alt';

  const iconColor =
    tone === 'danger' ? colors.accent : tone === 'warning' ? colors.warning : colors.muted;

  return (
    <Card className={border}>
      <CardBody className="gap-3">
        <View className="flex-row gap-3">
          <Icon name={icon} size={22} color={iconColor} />
          <View className="flex-1">
            <Text variant="label">{title}</Text>
            <Text variant="caption" tone="muted" className="mt-1">
              {body}
            </Text>
          </View>
        </View>

        {actionLabel && onAction ? (
          <Button label={actionLabel} variant="secondary" onPress={onAction} fullWidth />
        ) : null}
      </CardBody>
    </Card>
  );
}
