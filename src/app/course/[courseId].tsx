import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/layout/AppBar';
import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AttachmentRow } from '@/features/lessons/AttachmentRow';
import { AccessPanel } from '@/features/courses/components/AccessPanel';
import { SectionAccordion } from '@/features/courses/components/SectionAccordion';
import { courseAccessFlags, useCourse } from '@/features/courses/hooks';
import { EnrollSheet } from '@/features/enrollment/EnrollSheet';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';
import { toast } from '@/store/ui-store';
import type { LessonSummary } from '@/types/domain';
import { formatCompact, formatDate, formatDuration } from '@/utils/format';

type Tab = 'overview' | 'content' | 'materials';

/**
 * Course details.
 *
 * This screen is reachable *without* access — browsing and joining are
 * separate states. Everything gated is visibly gated (locked rows, an access
 * panel that explains the next step) rather than hidden, so the student can
 * evaluate the course before committing.
 */
export default function CourseDetailScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [tab, setTab] = React.useState<Tab>('overview');
  const [enrollOpen, setEnrollOpen] = React.useState(false);

  const query = useCourse(courseId);
  const course = query.data;

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !course) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <AppBar />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  const flags = courseAccessFlags(course);

  const openLesson = (lesson: LessonSummary) => {
    if (lesson.locked && !lesson.isPreview) {
      toast.info(t('access.lockedBody'));
      setEnrollOpen(flags.canJoin);
      return;
    }
    router.push(`/lesson/${lesson.id}`);
  };

  const continueCourse = () => {
    const target =
      course.progress?.lastLessonId ??
      course.sections.find((s) => !s.locked)?.lessons[0]?.id;

    if (target) router.push(`/lesson/${target}`);
    else toast.info(t('courses.empty.sectionsBody'));
  };

  const contactAdmin = () =>
    void support.whatsapp({ reason: 'access', courseTitle: course.title });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />
      <AppBar title={course.title} subtitle={course.teacher.fullName} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        {/* ---- hero ------------------------------------------------------ */}
        <View
          className="w-full items-center justify-center bg-surface-alt"
          style={{ aspectRatio: 16 / 9 }}
        >
          {course.thumbnailUrl ? (
            <Image
              source={{ uri: course.thumbnailUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Icon name="school" size={46} color={colors.subtle} />
          )}
        </View>

        <View className="px-4 pt-4">
          <Text variant="h2">{course.title}</Text>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Meta icon="document" label={t('common.lessonCount', { count: course.lessonCount })} />
            <Meta icon="courses" label={t('common.sectionCount', { count: course.sectionCount })} />
            <Meta icon="clock" label={formatDuration(course.totalDurationSeconds, language)} />
            {course.studentCount ? (
              <Meta
                icon="people"
                label={t('courses.enrolledStudents', { count: course.studentCount })}
              />
            ) : null}
          </View>

          {course.progress && flags.hasAccess ? (
            <View className="mt-4 rounded-md border border-border bg-surface p-3">
              <Text variant="label">{t('courses.yourProgress')}</Text>
              <ProgressBar percent={course.progress.percent} className="mt-2" showLabel />
              <Text variant="caption" tone="muted" className="mt-1">
                {t('progress.lessonsCompleted', {
                  done: course.progress.completedLessons,
                  total: course.progress.totalLessons,
                })}
              </Text>
            </View>
          ) : null}

          <View className="mt-4">
            <AccessPanel
              course={course}
              onJoin={() => setEnrollOpen(true)}
              onContinue={continueCourse}
              onContactAdmin={contactAdmin}
            />
          </View>
        </View>

        {/* ---- tabs ------------------------------------------------------ */}
        <View className="mt-6 flex-row gap-2 px-4">
          <Chip
            label={t('courses.overview')}
            selected={tab === 'overview'}
            onPress={() => setTab('overview')}
          />
          <Chip
            label={t('courses.content')}
            selected={tab === 'content'}
            onPress={() => setTab('content')}
          />
          <Chip
            label={t('courses.materials')}
            selected={tab === 'materials'}
            onPress={() => setTab('materials')}
          />
        </View>

        <View className="mt-4 px-4">
          {tab === 'overview' ? (
            <View className="gap-5">
              <View>
                <Text variant="title">{t('courses.aboutCourse')}</Text>
                <Text variant="body" tone="muted" className="mt-2">
                  {course.description}
                </Text>
              </View>

              {course.outcomes.length > 0 ? (
                <View>
                  <Text variant="title">{t('courses.whatYouLearn')}</Text>
                  <View className="mt-2 gap-2">
                    {course.outcomes.map((o) => (
                      <View key={o} className="flex-row gap-2">
                        <Icon name="check" size={16} color={colors.success} />
                        <Text variant="caption" tone="muted" className="flex-1">
                          {o}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {course.requirements.length > 0 ? (
                <View>
                  <Text variant="title">{t('courses.requirements')}</Text>
                  <View className="mt-2 gap-2">
                    {course.requirements.map((r) => (
                      <View key={r} className="flex-row gap-2">
                        <Icon name="chevron-right" size={14} color={colors.subtle} mirror />
                        <Text variant="caption" tone="muted" className="flex-1">
                          {r}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View>
                <Text variant="title">{t('courses.instructor')}</Text>
                <View className="mt-2 flex-row items-center gap-3 rounded-md border border-border bg-surface p-3">
                  <Avatar name={course.teacher.fullName} uri={course.teacher.avatarUrl} />
                  <View className="flex-1">
                    <Text variant="label">{course.teacher.fullName}</Text>
                    {course.teacher.title ? (
                      <Text variant="caption" tone="muted">
                        {course.teacher.title}
                      </Text>
                    ) : null}
                    {course.teacher.bio ? (
                      <Text variant="caption" tone="subtle" className="mt-1">
                        {course.teacher.bio}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {course.university ? (
                  <Badge label={course.university.name} icon="school" />
                ) : null}
                {course.academicYear ? (
                  <Badge label={course.academicYear.name} icon="calendar" />
                ) : null}
                {course.rating ? (
                  <Badge
                    label={formatCompact(course.rating, language)}
                    icon="star"
                    tone="warning"
                  />
                ) : null}
              </View>

              <Text variant="caption" tone="subtle">
                {t('courses.lastUpdated', { date: formatDate(course.updatedAt, language) })}
              </Text>
            </View>
          ) : null}

          {tab === 'content' ? (
            course.sections.length === 0 ? (
              <EmptyState
                icon="courses"
                title={t('courses.empty.sectionsTitle')}
                body={t('courses.empty.sectionsBody')}
                compact
              />
            ) : (
              <SectionAccordion
                sections={course.sections}
                hasAccess={flags.hasAccess}
                activeLessonId={course.progress?.lastLessonId ?? null}
                onSelectLesson={openLesson}
              />
            )
          ) : null}

          {tab === 'materials' ? (
            course.attachments.length === 0 ? (
              <EmptyState
                icon="pdf"
                title={t('lesson.noAttachments')}
                compact
              />
            ) : (
              <View className="overflow-hidden rounded-lg border border-border">
                {course.attachments.map((a) => (
                  <AttachmentRow
                    key={a.id}
                    attachment={a}
                    locked={!flags.hasAccess}
                  />
                ))}
              </View>
            )
          ) : null}
        </View>
      </ScrollView>

      <EnrollSheet
        course={course}
        visible={enrollOpen}
        onClose={() => setEnrollOpen(false)}
      />
    </SafeAreaView>
  );
}

function Meta({
  icon,
  label,
}: {
  icon: 'document' | 'clock' | 'people' | 'courses';
  label: string;
}) {
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

function DetailSkeleton() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AppBar />
      <Skeleton height={210} rounded="sm" />
      <View className="gap-3 p-4">
        <Skeleton height={26} width="80%" />
        <Skeleton height={14} width="50%" />
        <Skeleton height={52} rounded="md" className="mt-3" />
        <CardSkeleton />
      </View>
    </SafeAreaView>
  );
}
