import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { LessonSummary } from '@/types/domain';
import { formatDuration, formatTimecode } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface LessonRowProps {
  lesson: LessonSummary;
  index: number;
  locked: boolean;
  active?: boolean;
  onPress: () => void;
}

/**
 * A single lesson line.
 *
 * State is expressed through the leading glyph, which is the fastest thing to
 * scan: filled check = completed, ring with progress = partially watched,
 * lock = no access, play = ready. Locked rows stay pressable so tapping one
 * can explain *why* it's locked instead of silently doing nothing.
 */
export function LessonRow({ lesson, index, locked, active, onPress }: LessonRowProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();

  const progress = lesson.progress;
  const completed = progress?.completed ?? false;
  const partial = !completed && (progress?.percent ?? 0) > 0;

  const stateLabel = completed
    ? t('a11y.completedLesson')
    : locked
      ? t('a11y.locked')
      : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: false, selected: !!active }}
      accessibilityLabel={[
        t('a11y.lessonRow', {
          index,
          title: lesson.title,
          duration: formatDuration(lesson.durationSeconds, language),
        }),
        stateLabel,
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt',
        active && 'bg-primary-soft'
      )}
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <View className="h-9 w-9 items-center justify-center">
        {completed ? (
          <Icon name="checkCircle" size={22} color={colors.success} />
        ) : locked ? (
          <Icon name="lock" size={18} color={colors.subtle} />
        ) : (
          <View
            className={cn(
              'h-8 w-8 items-center justify-center rounded-full',
              active ? 'bg-primary' : 'bg-surface-alt'
            )}
          >
            <Icon
              name="play"
              size={13}
              color={active ? colors.primaryFg : colors.foreground}
            />
          </View>
        )}
      </View>

      <View className="flex-1">
        <Text
          variant="body"
          tone={locked ? 'subtle' : active ? 'primary' : 'default'}
          numberOfLines={2}
        >
          {lesson.title}
        </Text>

        <View className="mt-0.5 flex-row items-center gap-2">
          <Text variant="caption" tone="subtle" forceLatin>
            {formatTimecode(lesson.durationSeconds)}
          </Text>

          {lesson.kind !== 'VIDEO' ? (
            <Text variant="caption" tone="subtle">
              · {t(`lesson.kind.${lesson.kind}`)}
            </Text>
          ) : null}

          {lesson.attachmentCount > 0 ? (
            <View className="flex-row items-center gap-1">
              <Icon name="pdf" size={12} color={colors.subtle} />
              <Text variant="caption" tone="subtle" forceLatin>
                {lesson.attachmentCount}
              </Text>
            </View>
          ) : null}
        </View>

        {partial ? (
          <ProgressBar percent={progress!.percent} size="xs" className="mt-1.5" />
        ) : null}
      </View>

      {lesson.isPreview && locked ? (
        <Badge label={t('courses.preview')} tone="primary" />
      ) : null}
    </Pressable>
  );
}
