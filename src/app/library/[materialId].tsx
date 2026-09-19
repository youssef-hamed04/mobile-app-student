import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  useLibraryMaterial,
  useLibraryPurchase,
  useLibraryQuote,
} from '@/features/library/hooks';
import { useWallet } from '@/features/wallet/hooks';
import { useTranslation } from '@/hooks/use-translation';
import type {
  LibraryPackage,
  LibraryPart,
  LibraryPurchaseKind,
  LibraryQuote,
} from '@/types/domain';
import { formatMoney, localizedName } from '@/utils/format';

/**
 * One library material: its parts, its packages, and what the student owns.
 *
 * Buying is a two-step confirmation and both steps come from the server. The
 * quote is fetched when the sheet opens — the price, the balance, the shortfall
 * and how much of a package is already held — and the purchase is only then
 * offered. Nothing about the amount is computed here: a figure assembled on the
 * phone could disagree with the one the transaction actually charges, and this
 * is the screen where that would matter most.
 */
export default function LibraryMaterialScreen() {
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const { t, language } = useTranslation();
  const router = useRouter();

  const query = useLibraryMaterial(materialId);
  const wallet = useWallet();
  const quote = useLibraryQuote();
  const purchase = useLibraryPurchase(materialId);

  const [pending, setPending] = React.useState<{
    kind: LibraryPurchaseKind;
    targetId: string;
  } | null>(null);

  const openPurchase = (kind: LibraryPurchaseKind, targetId: string) => {
    setPending({ kind, targetId });
    quote.mutate({ kind, targetId });
  };

  const closeSheet = () => {
    setPending(null);
    quote.reset();
  };

  const confirm = async () => {
    if (!pending) return;
    await purchase.mutateAsync(pending);
    closeSheet();
  };

  if (query.isLoading) {
    return (
      <Screen edges={['top', 'bottom']} padded={false}>
        <AppBar showBack />
        <Spinner fullscreen />
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen edges={['top', 'bottom']} padded={false}>
        <AppBar showBack />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const material = query.data;
  const title = localizedName(
    { name: material.title, nameAr: material.titleAr },
    language
  );

  return (
    <Screen edges={['top']} padded={false} scroll>
      <AppBar title={title} showBack />

      <View className="px-4 pb-8 pt-2">
        <View className="flex-row gap-4">
          {material.coverUrl ? (
            <Image
              source={{ uri: material.coverUrl }}
              style={{ width: 92, height: 126, borderRadius: 10 }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View className="h-[126px] w-[92px] items-center justify-center rounded-[10px] bg-surface-alt">
              <Icon name="document" size={26} />
            </View>
          )}

          <View className="flex-1 gap-1.5">
            <Text variant="h3">{title}</Text>
            {material.subject ? (
              <Text variant="caption" tone="muted">
                {material.subject.name}
              </Text>
            ) : null}
            {material.ownsAllParts ? (
              <Badge tone="success" icon="check" label={t('library.ownAll')} />
            ) : null}
          </View>
        </View>

        {material.description ? (
          <Text variant="body" tone="muted" className="mt-4">
            {material.description}
          </Text>
        ) : null}

        {material.packages.length > 0 ? (
          <View className="mt-6">
            <SectionHeader
              title={t('library.packages')}
              subtitle={t('library.packagesSubtitle')}
            />
            <View className="gap-3">
              {material.packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onBuy={() => openPurchase('PACKAGE', pkg.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-6">
          <SectionHeader title={t('library.parts')} />
          {material.parts.length === 0 ? (
            <EmptyState
              compact
              icon="document"
              title={t('library.empty.partsTitle')}
              body={t('library.empty.partsBody')}
            />
          ) : (
            <View className="gap-3">
              {material.parts.map((part) => (
                <PartCard
                  key={part.id}
                  part={part}
                  onRead={() => router.push(`/library/reader/${part.id}`)}
                  onBuy={() => openPurchase('PART', part.id)}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      <Sheet
        visible={pending !== null}
        onClose={closeSheet}
        title={t('library.confirmTitle')}
      >
        <PurchaseSheetBody
          quote={quote.data}
          isLoading={quote.isPending}
          error={quote.error}
          balance={wallet.data?.balance ?? null}
          onTopUp={() => {
            closeSheet();
            router.push('/wallet');
          }}
          onConfirm={() => void confirm()}
          isPurchasing={purchase.isPending}
        />
      </Sheet>
    </Screen>
  );
}

function PartCard({
  part,
  onRead,
  onBuy,
}: {
  part: LibraryPart;
  onRead: () => void;
  onBuy: () => void;
}) {
  const { t, language } = useTranslation();
  const title = localizedName({ name: part.title, nameAr: part.titleAr }, language);

  return (
    <Card>
      <CardBody className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="label" numberOfLines={2}>
              {title}
            </Text>
            {part.pageCount ? (
              <Text variant="caption" tone="muted">
                {t('library.pageCount', { count: part.pageCount })}
              </Text>
            ) : null}
          </View>

          {part.isPreview && !part.owned ? (
            <Badge tone="info" icon="eye" label={t('library.preview')} />
          ) : part.owned ? (
            <Badge tone="success" icon="check" label={t('library.owned')} />
          ) : (
            <Text variant="label" tone="primary">
              {formatMoney({ amount: part.price, currency: part.currency }, language)}
            </Text>
          )}
        </View>

        {/*
          A preview is readable without owning it — the one documented way in
          without paying — so it gets the same Read button rather than a price.
        */}
        {part.owned || part.isPreview ? (
          <Button
            label={t('library.read')}
            variant="secondary"
            size="sm"
            iconStart="document"
            onPress={onRead}
            className="self-start"
          />
        ) : part.purchasable ? (
          <Button
            label={t('library.buy')}
            size="sm"
            iconStart="price"
            onPress={onBuy}
            className="self-start"
          />
        ) : (
          <Text variant="caption" tone="muted">
            {t('library.notPurchasable')}
          </Text>
        )}
      </CardBody>
    </Card>
  );
}

function PackageCard({ pkg, onBuy }: { pkg: LibraryPackage; onBuy: () => void }) {
  const { t, language } = useTranslation();
  const title = localizedName({ name: pkg.title, nameAr: pkg.titleAr }, language);

  return (
    <Card className="border-primary/30">
      <CardBody className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="label" numberOfLines={2}>
              {title}
            </Text>
            <Text variant="caption" tone="muted">
              {t('library.partCount', { count: pkg.partCount })}
            </Text>
          </View>
          <Text variant="label" tone="primary">
            {formatMoney({ amount: pkg.price, currency: pkg.currency }, language)}
          </Text>
        </View>

        {/*
          Overlap is stated before the student spends, not discovered after. A
          bundle that is already fully owned offers no button at all.
        */}
        {pkg.fullyOwned ? (
          <Badge tone="success" icon="check" label={t('library.ownAll')} />
        ) : (
          <>
            {pkg.partsAlreadyOwned > 0 ? (
              <Text variant="caption" tone="warning">
                {t('library.packageOverlap', {
                  owned: pkg.partsAlreadyOwned,
                  total: pkg.partCount,
                })}
              </Text>
            ) : null}
            <Button
              label={t('library.buyPackage')}
              size="sm"
              iconStart="price"
              onPress={onBuy}
              className="self-start"
            />
          </>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * The confirmation.
 *
 * Every number here came from the server's quote. When credit is short the
 * confirm button is replaced by a link to the wallet rather than being left
 * enabled to fail — the student is told what is missing and where to fix it.
 */
function PurchaseSheetBody({
  quote,
  isLoading,
  error,
  balance,
  onTopUp,
  onConfirm,
  isPurchasing,
}: {
  quote: LibraryQuote | undefined;
  isLoading: boolean;
  error: unknown;
  balance: number | null;
  onTopUp: () => void;
  onConfirm: () => void;
  isPurchasing: boolean;
}) {
  const { t, language } = useTranslation();

  if (isLoading) return <Spinner className="py-10" label={t('library.pricing')} />;
  if (error) return <ErrorState error={error} compact />;
  if (!quote) return null;

  const money = (amount: number) =>
    formatMoney({ amount, currency: quote.currency }, language) ?? '';

  return (
    <View className="gap-4 pb-2">
      <View className="gap-1">
        <Text variant="label">{quote.title}</Text>
        {quote.materialTitle ? (
          <Text variant="caption" tone="muted">
            {quote.materialTitle}
          </Text>
        ) : null}
      </View>

      <View className="gap-2 rounded-xl bg-surface-alt p-3">
        <Row label={t('library.price')} value={money(quote.price)} />
        <Row
          label={t('wallet.balance')}
          value={money(balance ?? quote.balance)}
        />
        {!quote.sufficientCredit ? (
          <Row
            label={t('library.shortfall')}
            value={money(quote.shortfall)}
            tone="warning"
          />
        ) : null}
        {quote.partCount > 1 ? (
          <Row
            label={t('library.included')}
            value={t('library.partCount', { count: quote.partCount })}
          />
        ) : null}
      </View>

      {quote.fullyOwned ? (
        <Text variant="caption" tone="warning">
          {t('library.alreadyOwnedBody')}
        </Text>
      ) : quote.partsAlreadyOwned > 0 ? (
        <Text variant="caption" tone="warning">
          {t('library.packageOverlap', {
            owned: quote.partsAlreadyOwned,
            total: quote.partCount,
          })}
        </Text>
      ) : null}

      {!quote.purchasable || quote.fullyOwned ? (
        <Text variant="caption" tone="muted">
          {t('library.notPurchasable')}
        </Text>
      ) : quote.sufficientCredit ? (
        <Button
          label={t('library.confirmBuy', { price: money(quote.price) })}
          loading={isPurchasing}
          onPress={onConfirm}
          fullWidth
        />
      ) : (
        <Button
          label={t('wallet.topUp')}
          variant="secondary"
          iconStart="price"
          onPress={onTopUp}
          fullWidth
        />
      )}
    </View>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="caption" tone={tone ?? 'default'}>
        {value}
      </Text>
    </View>
  );
}
