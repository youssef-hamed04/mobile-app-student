import { FlashList } from '@shopify/flash-list';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { IconButton } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  useAcademicYears,
  useUniversities,
} from '@/features/auth/hooks';
import type { CourseFilters } from '@/features/courses/api';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { useCourseList } from '@/features/courses/hooks';
import { useTranslation } from '@/hooks/use-translation';
import type { CourseSummary } from '@/types/domain';

type Sort = NonNullable<CourseFilters['sort']>;

/**
 * Course catalogue.
 *
 * FlashList rather than FlatList: course cards are a fixed-ish height and the
 * catalogue can run to hundreds of items, where FlatList's recycling costs
 * show up as blank cells on mid-range Android. `estimatedItemSize` is measured
 * from the real card, not guessed.
 */
export default function CoursesScreen() {
  const { t } = useTranslation();

  const [sort, setSort] = React.useState<Sort>('newest');
  const [freeOnly, setFreeOnly] = React.useState(false);
  const [universityId, setUniversityId] = React.useState<string | null>(null);
  const [academicYearId, setAcademicYearId] = React.useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const filters = React.useMemo<CourseFilters>(
    () => ({
      sort,
      free: freeOnly || undefined,
      universityId: universityId ?? undefined,
      academicYearId: academicYearId ?? undefined,
    }),
    [sort, freeOnly, universityId, academicYearId]
  );

  const query = useCourseList(filters);
  const universities = useUniversities();
  const years = useAcademicYears();

  const items = query.data?.items ?? [];
  const activeFilterCount =
    (freeOnly ? 1 : 0) + (universityId ? 1 : 0) + (academicYearId ? 1 : 0);

  const clearFilters = () => {
    setFreeOnly(false);
    setUniversityId(null);
    setAcademicYearId(null);
  };

  const renderItem = React.useCallback(
    ({ item }: { item: CourseSummary }) => <CourseCard course={item} />,
    []
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />

      <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
        <Text variant="h2" accessibilityRole="header">
          {t('courses.title')}
        </Text>
        <View className="flex-row">
          <IconButton
            icon="filter"
            accessibilityLabel={t('courses.filters')}
            onPress={() => setFiltersOpen(true)}
          />
        </View>
      </View>

      <View className="pb-3">
        <ChipRow>
          <Chip
            label={t('courses.sortNewest')}
            selected={sort === 'newest'}
            onPress={() => setSort('newest')}
          />
          <Chip
            label={t('courses.sortPopular')}
            selected={sort === 'popular'}
            onPress={() => setSort('popular')}
          />
          <Chip
            label={t('courses.filterFree')}
            selected={freeOnly}
            icon="price"
            onPress={() => setFreeOnly((v) => !v)}
          />
          {activeFilterCount > 0 ? (
            <Chip label={t('courses.clearFilters')} icon="close" onPress={clearFilters} />
          ) : null}
        </ChipRow>
      </View>

      {query.isLoading ? (
        <View className="px-4">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={items}
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
          ListHeaderComponent={
            items.length > 0 ? (
              <Text variant="caption" tone="muted" className="pb-3">
                {t('courses.resultsCount', { count: query.data?.total ?? items.length })}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title={t('courses.empty.listTitle')}
              body={t('courses.empty.listBody')}
              actionLabel={activeFilterCount > 0 ? t('courses.clearFilters') : undefined}
              onAction={activeFilterCount > 0 ? clearFilters : undefined}
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

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('courses.filters')}
      >
        <View className="gap-4 pb-2">
          <Select
            label={t('courses.filterUniversity')}
            value={universityId}
            options={universities.data ?? []}
            onChange={setUniversityId}
            loading={universities.isLoading}
          />
          <Select
            label={t('courses.filterYear')}
            value={academicYearId}
            options={years.data ?? []}
            onChange={setAcademicYearId}
            loading={years.isLoading}
          />
          <Select
            label={t('courses.sortBy')}
            value={sort}
            options={[
              { value: 'newest', label: t('courses.sortNewest') },
              { value: 'popular', label: t('courses.sortPopular') },
              { value: 'priceLow', label: t('courses.sortPriceLow') },
              { value: 'priceHigh', label: t('courses.sortPriceHigh') },
            ]}
            onChange={(v) => setSort(v as Sort)}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
