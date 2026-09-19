import { useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AdBanner } from '@/features/ads';
import { useAuth } from '@/features/auth/AuthProvider';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { useHomeFeed } from '@/features/courses/hooks';
import { ContinueWatchingCard } from '@/features/home/ContinueWatchingCard';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { formatCompact, formatDuration } from '@/utils/format';

/**
 * Student dashboard.
 *
 * Ordered by what a returning student most likely wants: resume the lesson
 * they were on, then their enrolled courses, then discovery. Sections with no
 * data are omitted entirely rather than rendering an empty shelf.
 */
export default function HomeScreen() {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();

  const feed = useHomeFeed();

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    const key =
      hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening';
    return t(key, { name: user?.fullName.split(' ')[0] ?? '' });
  }, [t, user?.fullName]);

  if (feed.isLoading) return <HomeSkeleton greeting={greeting} />;

  if (feed.isError) {
    return (
      <Screen>
        <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
      </Screen>
    );
  }

  const data = feed.data;
  const hasNothing =
    !data ||
    (data.continueWatching.length === 0 &&
      data.myCourses.length === 0 &&
      data.newCourses.length === 0 &&
      data.recommended.length === 0);

  return (
    <Screen
      padded={false}
      onRefresh={() => void feed.refetch()}
      refreshing={feed.isRefetching}
    >
      <View className="px-4 pb-2 pt-2">
        <Text variant="h2" numberOfLines={2}>
          {greeting}
        </Text>
        {user?.academicYear ? (
          <Text variant="caption" tone="muted" className="mt-1">
            {user.faculty?.name} · {user.academicYear.name}
          </Text>
        ) : null}
      </View>

      {/*
        Promotions sit between the header and the student's own content: high
        enough to be seen, but never above the greeting or ahead of the
        courses they came here for.

        They are derived from the feed's own announcements rather than fetched
        — there is no advertisement endpoint — so the carousel cannot be slower
        than, or fail independently of, the content below it.
      */}
      <AdBanner className="mb-6 mt-3" />

      {/*
        The Library's entry point. It is not a tab: the bar already carries six
        destinations, and this is somewhere students go deliberately rather
        than switch to mid-task.
      */}
      <View className="mb-6 px-4">
        <Card onPress={() => router.push('/library')}>
          <CardBody className="flex-row items-center gap-3">
            <Icon name="document" size={22} />
            <View className="flex-1 gap-0.5">
              <Text variant="label">{t('library.title')}</Text>
              <Text variant="caption" tone="muted">
                {t('library.browseSubtitle')}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} />
          </CardBody>
        </Card>
      </View>

      {data ? (
        <View className="mb-6 mt-3 flex-row gap-2 px-4">
          <Stat
            icon="courses"
            label={t('home.stats.courses')}
            value={formatCompact(data.stats.enrolledCourses, language)}
          />
          <Stat
            icon="checkCircle"
            label={t('home.stats.lessons')}
            value={formatCompact(data.stats.completedLessons, language)}
          />
          <Stat
            icon="clock"
            label={t('home.stats.watchTime')}
            value={formatDuration(data.stats.watchTimeSeconds, language)}
          />
          <Stat
            icon="flame"
            label={t('home.stats.streak')}
            value={formatCompact(data.stats.streakDays, language)}
          />
        </View>
      ) : null}

      {hasNothing ? (
        <EmptyState
          icon="school"
          title={t('home.noCoursesTitle')}
          body={t('home.noCoursesBody')}
          actionLabel={t('home.browseCourses')}
          onAction={() => router.push('/(tabs)/courses')}
        />
      ) : null}

      {data && data.continueWatching.length > 0 ? (
        <View className="mb-7">
          <View className="px-4">
            <SectionHeader title={t('home.continueWatching')} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 gap-3"
          >
            {data.continueWatching.map((item) => (
              <ContinueWatchingCard key={item.lesson.id} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {data && data.myCourses.length > 0 ? (
        <View className="mb-7">
          <View className="px-4">
            <SectionHeader
              title={t('home.myCourses')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/(tabs)/my-courses')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 gap-3"
          >
            {data.myCourses.map((course) => (
              <CourseCard key={course.id} course={course} layout="compact" />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {data && data.announcements.length > 0 ? (
        <View className="mb-7 px-4">
          <SectionHeader
            title={t('home.announcements')}
            actionLabel={t('common.seeAll')}
            onAction={() => router.push('/(tabs)/notifications')}
          />
          {data.announcements.slice(0, 2).map((n) => (
            <Card key={n.id} className="mb-2">
              <CardBody className="flex-row gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-md bg-primary-soft">
                  <Icon name="info" size={18} />
                </View>
                <View className="flex-1">
                  <Text variant="label" numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={2} className="mt-0.5">
                    {n.body}
                  </Text>
                </View>
              </CardBody>
            </Card>
          ))}
        </View>
      ) : null}

      {data && data.newCourses.length > 0 ? (
        <View className="mb-7">
          <View className="px-4">
            <SectionHeader
              title={t('home.newCourses')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/(tabs)/courses')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 gap-3"
          >
            {data.newCourses.map((course) => (
              <CourseCard key={course.id} course={course} layout="compact" />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {data && data.recommended.length > 0 ? (
        <View className="px-4">
          <SectionHeader title={t('home.recommended')} />
          {data.recommended.slice(0, 4).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 items-center rounded-md border border-border bg-surface px-1 py-3.5"
    >
      <Icon name={icon} size={16} color={colors.primary} />
      <Text variant="label" className="mt-1.5" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="subtle" numberOfLines={1} className="text-center">
        {label}
      </Text>
    </View>
  );
}

function HomeSkeleton({ greeting }: { greeting: string }) {
  return (
    <Screen padded={false}>
      <View className="px-4 pt-2">
        <Text variant="h2">{greeting}</Text>
      </View>

      <AdBanner className="mb-6 mt-3" />

      <View className="mb-6 mt-4 flex-row gap-2 px-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={72} rounded="md" className="flex-1" />
        ))}
      </View>

      <View className="px-4">
        <Skeleton height={22} width="45%" className="mb-3" />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    </Screen>
  );
}
