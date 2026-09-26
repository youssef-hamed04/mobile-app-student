import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AttachmentRow } from '@/features/lessons/AttachmentRow';
import { useLesson, useMarkLessonComplete } from '@/features/lessons/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { formatDuration, formatTimecode } from '@/utils/format';

/**
 * Lesson overview.
 *
 * Deliberately a separate screen from the player: opening a lesson must not
 * start protected playback (or consume a concurrency slot / issue a ticket).
 * The student sees what the lesson contains, then chooses to watch.
 */
export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const query = useLesson(lessonId);
  const lesson = query.data;
  const markComplete = useMarkLessonComplete(lessonId ?? '', lesson?.courseId);

  if (query.isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <AppBar />
        <View className="gap-3 p-4">
          <Skeleton height={190} rounded="md" />
          <Skeleton height={24} width="70%" />
          <Skeleton height={14} width="40%" />
          <ListSkeleton rows={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError || !lesson) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <AppBar />
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          onSecondary={() => router.back()}
          secondaryLabel={t('common.back')}
        />
      </SafeAreaView>
    );
  }

  const video = lesson.video;
  const progress = lesson.progress;
  // Every status the backend refuses a ticket for, not just PROCESSING: it
  // rejects UPLOADING and QUEUED the same way (VIDEO_NOT_READY), and showing
  // "Watch now" for those sent the student into a player that bounced straight
  // back out.
  const notReady =
    video?.status === 'UPLOADING' ||
    video?.status === 'QUEUED' ||
    video?.status === 'PROCESSING';
  const unavailable = video?.status === 'FAILED' || video?.status === 'ARCHIVED';

  const watch = () => {
    if (!video) return;
    router.push(`/player/${video.id}`);
  };

  const completionHint = t(`lesson.completionHint.${lesson.completionRule.type}`, {
    threshold: lesson.completionRule.threshold,
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />
      <AppBar title={lesson.title} subtitle={t('lesson.lesson')} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- video poster / entry point -------------------------------- */}
        {video ? (
          <View
            className="w-full items-center justify-center bg-ink-950"
            style={{ aspectRatio: 16 / 9 }}
          >
            {notReady ? (
              <View className="items-center px-8">
                <Icon name="clock" size={30} color="#FFFFFF" />
                <Text variant="label" className="mt-2 text-center text-white">
                  {t('player.notReadyTitle')}
                </Text>
                <Text variant="caption" className="mt-1 text-center text-white/70">
                  {t('player.notReadyBody')}
                </Text>
              </View>
            ) : unavailable ? (
              <View className="items-center px-8">
                <Icon name="error" size={30} color="#FFFFFF" />
                <Text variant="label" className="mt-2 text-center text-white">
                  {t('errors.VIDEO_UNAVAILABLE')}
                </Text>
              </View>
            ) : (
              <Button
                label={
                  progress && progress.positionSeconds > 5 && !progress.completed
                    ? t('lesson.resumeFrom', {
                        time: formatTimecode(progress.positionSeconds),
                      })
                    : t('lesson.watchNow')
                }
                iconStart="play"
                size="lg"
                onPress={watch}
              />
            )}

            {progress && progress.percent > 0 ? (
              <View className="absolute inset-x-0 bottom-0">
                <ProgressBar percent={progress.percent} size="xs" />
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="gap-5 px-4 pt-4">
          {/* ---- meta ---------------------------------------------------- */}
          <View>
            <Text variant="h3">{lesson.title}</Text>

            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Badge label={t(`lesson.kind.${lesson.kind}`)} icon="play" />
              <Badge
                label={formatDuration(lesson.durationSeconds, language)}
                icon="clock"
              />
              {progress?.completed ? (
                <Badge label={t('lesson.completed')} tone="success" icon="checkCircle" />
              ) : null}
              {lesson.isPreview ? (
                <Badge label={t('courses.preview')} tone="primary" />
              ) : null}
            </View>
          </View>

          {/* ---- description --------------------------------------------- */}
          {lesson.description ? (
            <View>
              <Text variant="title">{t('lesson.aboutLesson')}</Text>
              <Text variant="body" tone="muted" className="mt-2">
                {lesson.description}
              </Text>
            </View>
          ) : null}

          {/* ---- completion rule ------------------------------------------ */}
          <Card>
            <CardBody className="flex-row items-center gap-3">
              <Icon
                name={progress?.completed ? 'checkCircle' : 'progress'}
                size={20}
                color={progress?.completed ? colors.success : colors.muted}
              />
              <View className="flex-1">
                <Text variant="label">
                  {progress?.completed ? t('lesson.completed') : t('progress.inProgress')}
                </Text>
                <Text variant="caption" tone="muted" className="mt-0.5">
                  {completionHint}
                </Text>
              </View>

              {lesson.completionRule.type === 'MANUAL' && !progress?.completed ? (
                <Button
                  label={
                    markComplete.isPending ? t('lesson.marking') : t('lesson.markComplete')
                  }
                  size="sm"
                  variant="secondary"
                  loading={markComplete.isPending}
                  onPress={() => markComplete.mutate()}
                />
              ) : null}
            </CardBody>
          </Card>

          {/* ---- attachments ---------------------------------------------- */}
          <View>
            <Text variant="title" className="mb-2">
              {t('lesson.attachments')}
            </Text>

            {lesson.attachments.length === 0 ? (
              <EmptyState icon="pdf" title={t('lesson.noAttachments')} compact />
            ) : (
              <View className="overflow-hidden rounded-lg border border-border">
                {lesson.attachments.map((a) => (
                  <AttachmentRow key={a.id} attachment={a} locked={a.locked} />
                ))}
              </View>
            )}
          </View>

          {/* ---- prev / next ---------------------------------------------- */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              {lesson.previousLessonId ? (
                <Button
                  label={t('lesson.previousLesson')}
                  variant="secondary"
                  iconStart="chevron-left"
                  fullWidth
                  onPress={() => router.replace(`/lesson/${lesson.previousLessonId}`)}
                />
              ) : null}
            </View>
            <View className="flex-1">
              {lesson.nextLessonId ? (
                <Button
                  label={t('lesson.nextLesson')}
                  iconEnd="chevron-right"
                  fullWidth
                  onPress={() => router.replace(`/lesson/${lesson.nextLessonId}`)}
                />
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
