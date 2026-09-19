import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSupportTickets } from '@/features/support/hooks';
import { STATUS_TONE } from '@/features/support/status';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';
import type { SupportTicketSummary } from '@/types/domain';
import { formatRelative } from '@/utils/format';

/**
 * Support.
 *
 * Two routes to a human, and both are kept on purpose:
 *
 *  - **Tickets** are the tracked channel. They need a working session, which
 *    makes them useless for the case that brings most students here.
 *  - **Phone, WhatsApp and email** work when nothing else does. The platform
 *    has no self-service password reset by design, so for a student who cannot
 *    sign in these are not a convenience — they are the only way back in.
 *
 * The direct channels therefore stay first on the screen.
 */
export default function SupportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  const query = useSupportTickets();

  const context = {
    reason: 'general' as const,
    phone: user?.phone,
    fullName: user?.fullName,
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />
      <AppBar title={t('support.title')} showBack />

      <FlashList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TicketRow
            ticket={item}
            onPress={() => router.push(`/support/${item.id}`)}
          />
        )}
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
          <View className="gap-4 pb-4 pt-2">
            <ListSection title={t('support.directTitle')}>
              <ListItem
                title={t('support.callUs')}
                icon="phone"
                onPress={() => void support.call()}
              />
              <ListItem
                title={t('support.whatsapp')}
                icon="whatsapp"
                onPress={() => void support.whatsapp(context)}
              />
              <ListItem
                title={t('support.email')}
                icon="mail"
                onPress={() => void support.email(context)}
              />
            </ListSection>

            <Card>
              <CardBody className="gap-2">
                <Text variant="label">{t('support.ticketsTitle')}</Text>
                <Text variant="caption" tone="muted">
                  {t('support.ticketsBody')}
                </Text>
                <Button
                  label={t('support.newTicket')}
                  iconStart="add"
                  size="sm"
                  onPress={() => router.push('/support/new')}
                  className="mt-1 self-start"
                />
              </CardBody>
            </Card>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <ListSkeleton rows={3} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              compact
              icon="help"
              title={t('support.empty.title')}
              body={t('support.empty.body')}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="py-6">
              <Spinner size="small" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function TicketRow({
  ticket,
  onPress,
}: {
  ticket: SupportTicketSummary;
  onPress: () => void;
}) {
  const { t, language } = useTranslation();

  return (
    <Card onPress={onPress} className="mb-2" accessibilityLabel={ticket.subject}>
      <CardBody className="gap-1.5">
        <View className="flex-row items-start justify-between gap-3">
          <Text variant="label" className="flex-1" numberOfLines={2}>
            {ticket.subject}
          </Text>
          <Badge
            tone={STATUS_TONE[ticket.status]}
            label={t(`support.status.${ticket.status}`)}
          />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text variant="caption" tone="subtle">
            {ticket.reference}
          </Text>
          <Text variant="caption" tone="muted">
            {formatRelative(ticket.lastMessageAt, language)}
          </Text>
        </View>
      </CardBody>
    </Card>
  );
}
