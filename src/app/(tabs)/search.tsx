import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { SEARCH_MIN_CHARS } from '@/constants';
import { useRecentSearches, useSearch } from '@/features/search/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { SearchEntity, SearchResultItem } from '@/types/domain';
import { isSafeInternalRoute } from '@/utils/guards';

const ENTITY_ICON: Record<SearchEntity, 'courses' | 'play' | 'teacher' | 'pdf'> = {
  COURSE: 'courses',
  LESSON: 'play',
  TEACHER: 'teacher',
  ATTACHMENT: 'pdf',
};

/**
 * Search.
 *
 * Debounced, grouped by entity, with recent searches persisted locally. The
 * query is only sent once it clears the minimum length — a one-character
 * search is expensive server-side and useless to the student.
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [text, setText] = React.useState('');
  const [entity, setEntity] = React.useState<SearchEntity | 'ALL'>('ALL');

  const { recents, addRecent, clearRecents } = useRecentSearches();
  const { query, debouncedTerm } = useSearch(text, entity === 'ALL' ? undefined : entity);

  const tooShort = debouncedTerm.length > 0 && debouncedTerm.length < SEARCH_MIN_CHARS;
  const idle = debouncedTerm.length === 0;

  const open = (item: SearchResultItem) => {
    addRecent(debouncedTerm);
    if (isSafeInternalRoute(item.route)) router.push(item.route as never);
  };

  const groups = query.data ?? [];
  const hasResults = groups.some((g) => g.items.length > 0);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />

      <View className="gap-3 px-4 pb-3 pt-2">
        <Text variant="h2" accessibilityRole="header">
          {t('search.title')}
        </Text>

        <Input
          placeholder={t('search.placeholder')}
          value={text}
          onChangeText={setText}
          iconStart="search"
          iconEnd={text ? 'close' : undefined}
          onPressIconEnd={() => setText('')}
          iconEndAccessibilityLabel={t('common.close')}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => addRecent(text)}
          accessibilityLabel={t('search.placeholder')}
        />
      </View>

      {!idle ? (
        <View className="pb-3">
          <ChipRow>
            <Chip
              label={t('search.all')}
              selected={entity === 'ALL'}
              onPress={() => setEntity('ALL')}
            />
            {(['COURSE', 'LESSON', 'TEACHER'] as SearchEntity[]).map((e) => (
              <Chip
                key={e}
                label={t(`search.groups.${e}`)}
                selected={entity === e}
                onPress={() => setEntity(e)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {idle ? (
          <>
            {recents.length > 0 ? (
              <View className="mb-6">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text variant="label" tone="muted">
                    {t('search.recent')}
                  </Text>
                  <Pressable onPress={clearRecents} hitSlop={10} accessibilityRole="button">
                    <Text variant="caption" tone="primary">
                      {t('search.clearRecent')}
                    </Text>
                  </Pressable>
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {recents.map((r) => (
                    <Chip key={r} label={r} icon="clock" onPress={() => setText(r)} />
                  ))}
                </View>
              </View>
            ) : null}

            <EmptyState
              icon="search"
              title={t('search.idle.title')}
              body={t('search.idle.body')}
              compact
            />
          </>
        ) : tooShort ? (
          <EmptyState
            icon="search"
            title={t('search.minChars', { count: SEARCH_MIN_CHARS })}
            compact
          />
        ) : query.isLoading ? (
          <ListSkeleton rows={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !hasResults ? (
          <EmptyState
            icon="search"
            title={t('search.empty.title')}
            body={t('search.empty.body', { query: debouncedTerm })}
          />
        ) : (
          groups.map((group) => (
            <View key={group.entity} className="mb-6">
              <Text variant="overline" tone="subtle" className="mb-2">
                {t(`search.groups.${group.entity}`)} · {group.total}
              </Text>

              <View className="overflow-hidden rounded-lg border border-border">
                {group.items.map((item, i) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => open(item)}
                    className="flex-row items-center gap-3 bg-surface px-3 py-3 active:bg-surface-alt"
                    style={{
                      minHeight: MIN_TOUCH_TARGET,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-md bg-surface-alt">
                      <Icon
                        name={ENTITY_ICON[item.entity]}
                        size={16}
                        color={colors.muted}
                      />
                    </View>

                    <View className="flex-1">
                      <Text variant="body" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>

                    {item.locked ? (
                      <Icon name="lock" size={15} color={colors.subtle} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
