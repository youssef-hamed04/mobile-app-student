import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { SEARCH_DEBOUNCE_MS } from '@/constants';
import { useLibraryBrowse, useMyLibrary } from '@/features/library/hooks';
import { useWallet } from '@/features/wallet/hooks';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useTranslation } from '@/hooks/use-translation';
import type { LibraryMaterialSummary, MyLibraryItem } from '@/types/domain';
import { formatMoney, localizedName } from '@/utils/format';

type Tab = 'browse' | 'mine';

/**
 * The Library.
 *
 * Reached from Home and from Settings rather than from a tab. The tab bar
 * already carries six destinations, and a seventh would have cost every other
 * one legibility — this is a place students visit deliberately, not one they
 * switch between mid-task.
 *
 * The balance is shown in the header because it is the constraint on every
 * decision made on this screen. It links to the wallet, and it is the only
 * place in the app where credit and content appear together: courses do not
 * spend it.
 */
export default function LibraryScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();

  const [tab, setTab] = React.useState<Tab>('browse');
  const [rawQuery, setRawQuery] = React.useState('');
  const q = useDebouncedValue(rawQuery.trim(), SEARCH_DEBOUNCE_MS);

  const wallet = useWallet();
  const browse = useLibraryBrowse(q.length > 0 ? { q } : {});
  const mine = useMyLibrary();

  const active = tab === 'browse' ? browse : mine;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />
      <AppBar
        title={t('library.title')}
        showBack
        right={
          <Card
            onPress={() => router.push('/wallet')}
            accessibilityLabel={t('wallet.openA11y')}
            className="px-3 py-1.5"
          >
            <View className="flex-row items-center gap-1.5">
              <Icon name="price" size={15} />
              <Text variant="caption">
                {wallet.isLoading
                  ? '…'
                  : formatMoney(
                      {
                        amount: wallet.data?.balance ?? 0,
                        currency: wallet.data?.currency ?? 'EGP',
                      },
                      language
                    )}
              </Text>
            </View>
          </Card>
        }
      />

      <View className="pb-2 pt-1">
        <ChipRow>
          <Chip
            label={t('library.tabBrowse')}
            selected={tab === 'browse'}
            onPress={() => setTab('browse')}
          />
          <Chip
            label={t('library.tabMine')}
            selected={tab === 'mine'}
            onPress={() => setTab('mine')}
          />
        </ChipRow>
      </View>

      {tab === 'browse' ? (
        <View className="px-4 pb-2">
          <Input
            value={rawQuery}
            onChangeText={setRawQuery}
            placeholder={t('library.searchPlaceholder')}
            iconStart="search"
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      ) : null}

      {active.isLoading ? (
        <View className="px-4">
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : tab === 'browse' ? (
        <FlashList
          data={browse.data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MaterialCard
              material={item}
              onPress={() => router.push(`/library/${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => void browse.refetch()}
          refreshing={browse.isRefetching && !browse.isFetchingNextPage}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (browse.hasNextPage && !browse.isFetchingNextPage) {
              void browse.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <EmptyState
              icon="document"
              title={
                q.length > 0
                  ? t('library.empty.searchTitle')
                  : t('library.empty.browseTitle')
              }
              body={
                q.length > 0
                  ? t('library.empty.searchBody')
                  : t('library.empty.browseBody')
              }
            />
          }
          ListFooterComponent={
            browse.isFetchingNextPage ? (
              <View className="py-6">
                <Spinner size="small" />
              </View>
            ) : null
          }
        />
      ) : (
        <FlashList
          data={mine.data?.items ?? []}
          keyExtractor={(item) => item.entitlementId}
          renderItem={({ item }) => (
            <OwnedDocumentRow
              item={item}
              onPress={() => router.push(`/library/reader/${item.partId}`)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => void mine.refetch()}
          refreshing={mine.isRefetching && !mine.isFetchingNextPage}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (mine.hasNextPage && !mine.isFetchingNextPage) {
              void mine.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <EmptyState
              icon="document"
              title={t('library.empty.mineTitle')}
              body={t('library.empty.mineBody')}
              actionLabel={t('library.tabBrowse')}
              onAction={() => setTab('browse')}
            />
          }
          ListFooterComponent={
            mine.isFetchingNextPage ? (
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

function MaterialCard({
  material,
  onPress,
}: {
  material: LibraryMaterialSummary;
  onPress: () => void;
}) {
  const { t, language } = useTranslation();
  const title = localizedName(
    { name: material.title, nameAr: material.titleAr },
    language
  );

  return (
    <Card onPress={onPress} className="mb-3" accessibilityLabel={title}>
      <CardBody className="flex-row gap-3">
        {material.coverUrl ? (
          <Image
            source={{ uri: material.coverUrl }}
            style={{ width: 64, height: 88, borderRadius: 8 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-[88px] w-16 items-center justify-center rounded-lg bg-surface-alt">
            <Icon name="document" size={22} />
          </View>
        )}

        <View className="flex-1 gap-1">
          <Text variant="label" numberOfLines={2}>
            {title}
          </Text>

          {material.subject ? (
            <Text variant="caption" tone="muted">
              {material.subject.name}
            </Text>
          ) : null}

          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            <Badge
              tone="neutral"
              label={t('library.partCount', { count: material.partCount })}
            />
            {material.packageCount > 0 ? (
              <Badge
                tone="info"
                label={t('library.packageCount', { count: material.packageCount })}
              />
            ) : null}
          </View>

          {material.priceFrom !== null ? (
            <Text variant="caption" tone="primary" className="mt-1">
              {t('library.priceFrom', {
                price:
                  formatMoney({ amount: material.priceFrom, currency: 'EGP' }, language) ??
                  '',
              })}
            </Text>
          ) : null}
        </View>
      </CardBody>
    </Card>
  );
}

function OwnedDocumentRow({
  item,
  onPress,
}: {
  item: MyLibraryItem;
  onPress: () => void;
}) {
  const { t, language } = useTranslation();
  const title = localizedName({ name: item.title, nameAr: item.titleAr }, language);

  return (
    <Card
      onPress={item.available ? onPress : undefined}
      disabled={!item.available}
      className="mb-3"
      accessibilityLabel={title}
    >
      <CardBody className="flex-row items-center gap-3">
        <Icon name={item.mimeType?.includes('pdf') ? 'pdf' : 'document'} size={22} />

        <View className="flex-1 gap-0.5">
          <Text variant="label" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {item.materialTitle}
          </Text>
        </View>

        {/*
          A withdrawn document stays listed because the student did buy it.
          Saying so plainly is better than removing the row and leaving them to
          wonder where their purchase went.
        */}
        {item.available ? (
          <Icon name="chevron-right" size={18} />
        ) : (
          <Badge tone="warning" label={t('library.unavailable')} />
        )}
      </CardBody>
    </Card>
  );
}
