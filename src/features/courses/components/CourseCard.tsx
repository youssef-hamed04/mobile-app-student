import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { AccessState, CourseSummary } from '@/types/domain';
import { formatCompact, formatDuration, formatMoney } from '@/utils/format';

const ACCESS_BADGE: Record<AccessState, { key: string; tone: BadgeTone } | null> = {
  NOT_ENROLLED: null,
  ACTIVE: { key: 'access.active', tone: 'success' },
  PENDING_APPROVAL: { key: 'access.pendingApproval', tone: 'warning' },
  PENDING_PAYMENT: { key: 'access.pendingPayment', tone: 'warning' },
  EXPIRED: { key: 'access.expired', tone: 'danger' },
  REVOKED: { key: 'access.revoked', tone: 'danger' },
  ARCHIVED: { key: 'access.archived', tone: 'neutral' },
};

export interface CourseCardProps {
  course: CourseSummary;
  /** `compact` is the horizontal carousel variant used on Home. */
  layout?: 'full' | 'compact';
  onPress?: () => void;
}

/**
 * The single course representation used everywhere (catalogue, my courses,
 * home carousels, search). One component means the access badge, price and
 * progress rules can never drift between screens.
 */
export function CourseCard({ course, layout = 'full', onPress }: CourseCardProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const badge = ACCESS_BADGE[course.access.state];
  const price = formatMoney(course.price, language);
  const compact = layout === 'compact';

  const go = onPress ?? (() => router.push(`/course/${course.id}`));

  return (
    <Card
      onPress={go}
      accessibilityLabel={t('a11y.courseCard', {
        title: course.title,
        teacher: course.teacher.fullName,
      })}
      className={compact ? 'w-[260px]' : 'mb-4'}
    >
      {/* ---- thumbnail --------------------------------------------------- */}
      <View
        className="w-full items-center justify-center bg-surface-alt"
        style={{ aspectRatio: 16 / 9 }}
      >
        {course.thumbnailUrl ? (
          <Image
            source={{ uri: course.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Icon name="school" size={compact ? 30 : 38} color={colors.subtle} />
        )}

        {badge ? (
          <View className="absolute end-2 top-2">
            <Badge label={t(badge.key)} tone={badge.tone} />
          </View>
        ) : null}

        {course.isFree ? (
          <View className="absolute start-2 top-2">
            <Badge label={t('common.free')} tone="primary" />
          </View>
        ) : null}
      </View>

      {/* ---- body -------------------------------------------------------- */}
      <View className="gap-1.5 p-3.5">
        <Text variant={compact ? 'label' : 'bodyStrong'} numberOfLines={2}>
          {course.title}
        </Text>

        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t('courses.by', { name: course.teacher.fullName })}
        </Text>

        {!compact && course.shortDescription ? (
          <Text variant="caption" tone="subtle" numberOfLines={2} className="mt-0.5">
            {course.shortDescription}
          </Text>
        ) : null}

        <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Meta
            icon="document"
            label={t('common.lessonCount', { count: course.lessonCount })}
          />
          <Meta
            icon="clock"
            label={formatDuration(course.totalDurationSeconds, language)}
          />
          {course.studentCount ? (
            <Meta icon="people" label={formatCompact(course.studentCount, language)} />
          ) : null}
        </View>

        {course.progress && course.progress.percent > 0 ? (
          <View className="mt-2">
            <ProgressBar percent={course.progress.percent} size="xs" />
            <Text variant="caption" tone="muted" className="mt-1">
              {t('progress.lessonsCompleted', {
                done: course.progress.completedLessons,
                total: course.progress.totalLessons,
              })}
            </Text>
          </View>
        ) : null}

        {!course.isFree && price && course.access.state === 'NOT_ENROLLED' ? (
          <Text variant="label" tone="primary" className="mt-1.5">
            {price}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Meta({ icon, label }: { icon: 'document' | 'clock' | 'people'; label: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={icon} size={13} color={colors.subtle} />
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
    </View>
  );
}
