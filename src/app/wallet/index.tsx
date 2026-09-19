import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { AppBar } from '@/components/layout/AppBar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  useRedeemRecharge,
  useWallet,
  useWalletTransactions,
} from '@/features/wallet/hooks';
import { useTranslation } from '@/hooks/use-translation';
import type { WalletTransaction } from '@/types/domain';
import { formatDateTime, formatMoney } from '@/utils/format';

/**
 * Wallet credit.
 *
 * The scope note on this screen is not decoration. Students arrive here
 * expecting credit to unlock courses, because that is how most platforms work,
 * and it is not how this one works: **credit buys Library documents and nothing
 * else.** Courses and course parts are unlocked with access cards bought
 * offline. Saying so on the screen is cheaper than a support ticket.
 *
 * Credit arrives by redeeming a recharge card. There is no top-up amount to
 * type: the value comes from the card, which is why nothing here sends a
 * figure to the server.
 */
export default function WalletScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();

  const wallet = useWallet();
  const transactions = useWalletTransactions();
  const redeem = useRedeemRecharge();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [code, setCode] = React.useState('');

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;

    try {
      await redeem.mutateAsync(trimmed);
      setCode('');
      setSheetOpen(false);
    } catch {
      // Left open, with the error rendered in the sheet: the student will want
      // to correct a typo rather than start over.
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />
      <AppBar title={t('wallet.title')} showBack />

      <FlashList
        data={transactions.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onRefresh={() => {
          void wallet.refetch();
          void transactions.refetch();
        }}
        refreshing={transactions.isRefetching && !transactions.isFetchingNextPage}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) {
            void transactions.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View className="gap-4 pb-4 pt-2">
            <Card className="border-primary/30 bg-primary-soft">
              <CardBody className="gap-2">
                <Text variant="caption" tone="muted">
                  {t('wallet.balance')}
                </Text>

                {wallet.isLoading ? (
                  <Skeleton height={34} width="50%" />
                ) : wallet.isError ? (
                  <InlineError error={wallet.error} />
                ) : (
                  <Text variant="h1" tone="primary">
                    {formatMoney(
                      {
                        amount: wallet.data?.balance ?? 0,
                        currency: wallet.data?.currency ?? 'EGP',
                      },
                      language
                    )}
                  </Text>
                )}

                <Button
                  label={t('wallet.redeemCard')}
                  iconStart="code"
                  onPress={() => setSheetOpen(true)}
                  className="mt-1 self-start"
                  size="sm"
                />
              </CardBody>
            </Card>

            {/*
              The single most useful sentence on this screen. Without it the
              natural assumption is that credit buys courses.
            */}
            <Card>
              <CardBody className="flex-row gap-3">
                <Icon name="info" size={20} />
                <View className="flex-1 gap-1">
                  <Text variant="label">{t('wallet.scopeTitle')}</Text>
                  <Text variant="caption" tone="muted">
                    {t('wallet.scopeBody')}
                  </Text>
                  <Button
                    label={t('library.title')}
                    variant="ghost"
                    size="sm"
                    iconEnd="chevron-right"
                    onPress={() => router.push('/library')}
                    className="mt-1 self-start"
                  />
                </View>
              </CardBody>
            </Card>

            <Text variant="h3" className="mt-2">
              {t('wallet.history')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          transactions.isLoading ? (
            <Spinner className="py-10" />
          ) : transactions.isError ? (
            <ErrorState
              error={transactions.error}
              onRetry={() => void transactions.refetch()}
            />
          ) : (
            <EmptyState
              compact
              icon="empty"
              title={t('wallet.empty.title')}
              body={t('wallet.empty.body')}
            />
          )
        }
        ListFooterComponent={
          transactions.isFetchingNextPage ? (
            <View className="py-6">
              <Spinner size="small" />
            </View>
          ) : null
        }
      />

      <Sheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          redeem.reset();
        }}
        title={t('wallet.redeemCard')}
        subtitle={t('wallet.redeemSubtitle')}
      >
        <View className="gap-3 pb-2">
          <Input
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            iconStart="code"
            accessibilityLabel={t('wallet.redeemCard')}
          />

          {redeem.isError ? <InlineError error={redeem.error} /> : null}

          <Button
            label={t('access.redeem')}
            loading={redeem.isPending}
            disabled={code.trim().length < 4}
            onPress={() => void submit()}
            fullWidth
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const { t, language } = useTranslation();
  const isCredit = tx.direction === 'CREDIT';

  return (
    <Card className="mb-2">
      <CardBody className="flex-row items-center gap-3">
        <Icon name={isCredit ? 'add' : 'price'} size={18} />

        <View className="flex-1 gap-0.5">
          <Text variant="label" numberOfLines={1}>
            {tx.note ?? t(`wallet.tx.${tx.type}`, { defaultValue: tx.type })}
          </Text>
          <Text variant="caption" tone="muted">
            {formatDateTime(tx.createdAt, language)}
          </Text>
        </View>

        <View className="items-end gap-0.5">
          <Text variant="label" tone={isCredit ? 'success' : 'default'}>
            {isCredit ? '+' : '−'}
            {formatMoney({ amount: tx.amount, currency: tx.currency }, language)}
          </Text>
          <Text variant="caption" tone="subtle">
            {formatMoney({ amount: tx.balanceAfter, currency: tx.currency }, language)}
          </Text>
        </View>
      </CardBody>
    </Card>
  );
}
