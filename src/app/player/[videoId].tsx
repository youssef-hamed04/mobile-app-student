import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useLessonByVideo, useMarkLessonComplete } from '@/features/lessons/hooks';
import { ProtectedVideoPlayer } from '@/features/video/ProtectedVideoPlayer';
import { usePlayerStore } from '@/store/player-store';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Fullscreen protected playback route.
 *
 * Presented as a `fullScreenModal` with gestures disabled, so the secure
 * surface can't be swiped partially off-screen mid-frame. The player itself
 * never receives anything except identifiers, and resolves the playable URL
 * through the ticket API.
 *
 * The route is addressed by VIDEO id and asks the server which lesson that
 * belongs to. Video ids and lesson ids are independent cuids: nothing about
 * one can be computed from the other.
 */
export default function PlayerRoute() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const autoplayNext = usePlayerStore((s) => s.autoplayNext);

  const lessonQuery = useLessonByVideo(videoId);
  const lesson = lessonQuery.data;
  const markComplete = useMarkLessonComplete(lesson?.id ?? '', lesson?.courseId);

  const close = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  if (lessonQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Spinner label={t('player.preparing')} />
      </View>
    );
  }

  if (lessonQuery.isError || !lesson?.video) {
    return (
      <View className="flex-1 justify-center bg-black">
        <ErrorState
          error={lessonQuery.error}
          onRetry={() => void lessonQuery.refetch()}
          onSecondary={close}
          secondaryLabel={t('common.close')}
        />
      </View>
    );
  }

  return (
    <ProtectedVideoPlayer
      videoId={lesson.video.id}
      lessonQualities={lesson.video.availableQualities}
      lessonId={lesson.id}
      courseId={lesson.courseId}
      title={lesson.title}
      subtitle={t('lesson.lesson')}
      completionRule={lesson.completionRule}
      onClose={close}
      onCompleted={() => {
        // Server-side rules are authoritative; this only nudges the record
        // forward for MANUAL courses where the student watched it all.
        if (lesson.completionRule.type === 'MANUAL' && !lesson.progress?.completed) {
          markComplete.mutate();
        }
      }}
      onEnded={() => {
        // Only autoplay when the next lesson actually has a video. A document
        // or quiz lesson has no video id, and navigating to the player with
        // `undefined` would strand the student on an error screen.
        if (autoplayNext && lesson.nextVideoId) {
          router.replace(`/player/${lesson.nextVideoId}`);
        } else {
          close();
        }
      }}
    />
  );
}
