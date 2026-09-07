import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { ContinueWatchingItem } from '@/types/domain';
import { formatTimecode } from '@/utils/format';

/**
 * Resume card.
 *
 * Routes straight into the lesson rather than the course, because the whole
 * point is one tap back to where the student stopped. The remaining time —
 * not the elapsed time — is shown, since "12 min left" is what actually
 * drives the decision to press play.
 */
export function ContinueWatchingCard({ item }: { item: ContinueWatchingItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const remaining = Math.max(
    0,
    item.progress.durationSeconds - item.progress.positionSeconds
  );

  return (
    <Card
      onPress={() => router.push(`/lesson/${item.lesson.id}`)}
      accessibilityLabel={`${t('home.resume')}: ${item.lesson.title}`}
      className="w-[280px]"
    >
      <View
        className="w-full items-center justify-center bg-surface-alt"
        style={{ aspectRatio: 16 / 9 }}
      >
        {item.course.thumbnailUrl ? (
          <Image
            source={{ uri: item.course.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Icon name="playCircle" size={34} color={colors.subtle} />
        )}

        {/* Play affordance */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/90">
            <Icon name="play" size={20} color={colors.primaryFg} />
          </View>
        </View>

        {/* Remaining time chip */}
        <View className="absolute bottom-2 end-2 rounded-sm bg-black/70 px-1.5 py-0.5">
          <Text variant="caption" className="text-white" forceLatin>
            {formatTimecode(remaining)}
          </Text>
        </View>

        {/* Progress hairline pinned to the bottom of the thumbnail */}
        <View className="absolute inset-x-0 bottom-0">
          <ProgressBar percent={item.progress.percent} size="xs" />
        </View>
      </View>

      <View className="gap-1 p-3">
        <Text variant="label" numberOfLines={2}>
          {item.lesson.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {item.course.title}
        </Text>
      </View>
    </Card>
  );
}
