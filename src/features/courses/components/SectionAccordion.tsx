import * as React from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { CourseSection, LessonSummary } from '@/types/domain';
import { formatDate, formatDuration } from '@/utils/format';

import { LessonRow } from './LessonRow';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface SectionAccordionProps {
  sections: CourseSection[];
  hasAccess: boolean;
  /** Lesson currently being watched, highlighted in the list. */
  activeLessonId?: string | null;
  onSelectLesson: (lesson: LessonSummary) => void;
  /** Section id to expand initially; defaults to the first unlocked one. */
  initialExpandedId?: string | null;
}

/**
 * Renders whatever section structure the backend sends.
 *
 * There is no assumption anywhere about how many sections exist, what they
 * are called, or that a "midterm" exists at all — the array order from the
 * server is the display order, and section titles are plain strings from the
 * course configuration.
 */
export function SectionAccordion({
  sections,
  hasAccess,
  activeLessonId,
  onSelectLesson,
  initialExpandedId,
}: SectionAccordionProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();

  const firstOpenable = React.useMemo(
    () => sections.find((s) => !s.locked)?.id ?? sections[0]?.id ?? null,
    [sections]
  );

  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const initial = initialExpandedId ?? firstOpenable;
    return new Set(initial ? [initial] : []);
  });

  // Auto-expand the section containing the lesson being watched.
  React.useEffect(() => {
    if (!activeLessonId) return;
    const owner = sections.find((s) =>
      s.lessons.some((l) => l.id === activeLessonId)
    );
    if (owner) setExpanded((prev) => new Set(prev).add(owner.id));
  }, [activeLessonId, sections]);

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <View className="gap-3">
      {sections.map((section, index) => {
        const open = expanded.has(section.id);
        const sectionLocked = section.locked || !hasAccess;

        return (
          <View
            key={section.id}
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${section.title}. ${t('common.lessonCount', {
                count: section.lessonCount,
              })}`}
              onPress={() => toggle(section.id)}
              className="flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-alt"
              style={{ minHeight: MIN_TOUCH_TARGET }}
            >
              <View className="h-8 w-8 items-center justify-center rounded-md bg-primary-soft">
                <Text variant="label" tone="primary" forceLatin>
                  {index + 1}
                </Text>
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text variant="bodyStrong" numberOfLines={2} className="flex-1">
                    {section.title}
                  </Text>
                  {section.locked ? (
                    <Icon name="lock" size={14} color={colors.subtle} />
                  ) : null}
                </View>

                <Text variant="caption" tone="muted" className="mt-0.5">
                  {t('common.lessonCount', { count: section.lessonCount })}
                  {' · '}
                  {formatDuration(section.durationSeconds, language)}
                </Text>

                {section.locked && section.unlocksAt ? (
                  <Badge
                    label={t('access.unlocksOn', {
                      date: formatDate(section.unlocksAt, language),
                    })}
                    tone="warning"
                    icon="clock"
                    className="mt-1.5"
                  />
                ) : null}

                {hasAccess && section.progressPercent > 0 ? (
                  <ProgressBar
                    percent={section.progressPercent}
                    size="xs"
                    className="mt-2"
                  />
                ) : null}
              </View>

              <Icon
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.muted}
              />
            </Pressable>

            {open ? (
              <View className="border-t border-border">
                {section.description ? (
                  <Text variant="caption" tone="muted" className="px-4 pb-1 pt-3">
                    {section.description}
                  </Text>
                ) : null}

                {section.lessons.length === 0 ? (
                  <Text variant="caption" tone="subtle" className="px-4 py-5 text-center">
                    {t('courses.empty.lessonsBody')}
                  </Text>
                ) : (
                  section.lessons.map((lesson, i) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      index={i + 1}
                      locked={sectionLocked && !lesson.isPreview}
                      active={lesson.id === activeLessonId}
                      onPress={() => onSelectLesson(lesson)}
                    />
                  ))
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
