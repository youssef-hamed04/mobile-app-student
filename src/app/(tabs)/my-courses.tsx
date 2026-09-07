import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { useMyCourses } from '@/features/courses/hooks';
import { useTranslation } from '@/hooks/use-translation';
import type { CourseSummary } from '@/types/domain';

type Tab = 'active' | 'completed' | 'inactive';

/**
 * Enrolled courses.
 *
 * Split into three buckets because "my courses" otherwise mixes a course the
 * student is halfway through with one whose access expired six months ago.
 * Expired and archived courses stay visible on purpose — the student needs to
 * see them to know to contact the administration.
 */
export default function MyCoursesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>('active');

  const query = useMyCourses();
  const all = query.data?.items ?? [];

  const filtered = React.useMemo(() => {
    if (tab === 'active') {
      return all.filter(
        (c) => c.access.state === 'ACTIVE' && (c.progress?.percent ?? 0) < 100
      );
    }
    if (tab === 'completed') {
      return all.filter((c) => (c.progress?.percent ?? 0) >= 100);
    }
    return all.filter(
      (c) =>
        c.access.state === 'EXPIRED' ||
        c.access.state === 'ARCHIVED' ||
        c.access.state === 'REVOKED'
    );
  }, [all, tab]);

  const renderItem = React.useCallback(
    ({ item }: { item: CourseSummary }) => <CourseCard course={item} />,
    []
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />

      <View className="px-4 pb-1 pt-2">
        <Text variant="h2" accessibilityRole="header">
          {t('courses.myCourses')}
        </Text>
      </View>

      <View className="pb-3 pt-2">
        <ChipRow>
          <Chip
            label={t('progress.inProgress')}
            selected={tab === 'active'}
            onPress={() => setTab('active')}
          />
          <Chip
            label={t('progress.completed')}
            selected={tab === 'completed'}
            onPress={() => setTab('completed')}
          />
          <Chip
            label={t('access.expired')}
            selected={tab === 'inactive'}
            onPress={() => setTab('inactive')}
          />
        </ChipRow>
      </View>

      {query.isLoading ? (
        <View className="px-4">
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => void query.refetch()}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <EmptyState
              icon="myCoursesOutline"
              title={t('courses.empty.mineTitle')}
              body={t('courses.empty.mineBody')}
              actionLabel={t('home.browseCourses')}
              onAction={() => router.push('/(tabs)/courses')}
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-6">
                <Spinner size="small" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
