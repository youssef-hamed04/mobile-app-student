import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/feedback/NetworkBanner';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import {
  getPermissionStatus,
  requestPermission,
  registerPushToken,
} from '@/services/notifications';
import { support } from '@/services/support';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { AppNotification, NotificationKind } from '@/types/domain';
import { formatRelative } from '@/utils/format';
import { isSafeInternalRoute } from '@/utils/guards';

const KIND_ICON: Record<NotificationKind, IconName> = {
  NEW_COURSE: 'school',
  NEW_SECTION: 'courses',
  NEW_LESSON: 'play',
  NEW_VIDEO: 'playCircle',
  ANNOUNCEMENT: 'info',
  PAYMENT: 'price',
  ENROLLMENT: 'checkCircle',
  COURSE_UPDATE: 'refresh',
  ADMIN: 'person',
  SECURITY: 'shield',
};

export default function NotificationsScreen() {
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [permission, setPermission] = React.useState<string | null>(null);

  const query = useNotifications(unreadOnly);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  React.useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);

  const enablePush = async () => {
    const outcome = await requestPermission();
    setPermission(outcome);
    if (outcome === 'granted') await registerPushToken();
    else if (outcome === 'denied') void support.openSettings();
  };

  const items = query.data?.items ?? [];

  const openNotification = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (isSafeInternalRoute(n.route)) router.push(n.route as never);
  };

  const renderItem = React.useCallback(
    ({ item }: { item: AppNotification }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(`notifications.kind.${item.kind}`)}: ${item.title}. ${item.body}`}
        onPress={() => openNotification(item)}
        className="mb-2 active:opacity-80"
        style={{ minHeight: MIN_TOUCH_TARGET }}
      >
        <Card className={item.read ? undefined : 'border-primary/40 bg-primary-soft'}>
          <CardBody className="flex-row gap-3 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-md bg-surface-alt">
              <Icon
                name={KIND_ICON[item.kind]}
                size={17}
                color={item.read ? colors.muted : colors.primary}
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-start gap-2">
                <Text variant="label" className="flex-1" numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.read ? (
                  <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </View>

              <Text variant="caption" tone="muted" className="mt-1" numberOfLines={3}>
                {item.body}
              </Text>

              <Text variant="caption" tone="subtle" className="mt-1.5">
                {formatRelative(item.createdAt, language)}
              </Text>
            </View>
          </CardBody>
        </Card>
      </Pressable>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, language, t]
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <NetworkBanner />

      <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
        <Text variant="h2" accessibilityRole="header">
          {t('notifications.title')}
        </Text>
        {items.some((n) => !n.read) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markAll.mutate()}
            hitSlop={10}
          >
            <Text variant="caption" tone="primary">
              {t('notifications.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="pb-3 pt-2">
        <ChipRow>
          <Chip
            label={t('notifications.all')}
            selected={!unreadOnly}
            onPress={() => setUnreadOnly(false)}
          />
          <Chip
            label={t('notifications.unread')}
            selected={unreadOnly}
            onPress={() => setUnreadOnly(true)}
          />
        </ChipRow>
      </View>

      {permission === 'undetermined' || permission === 'denied' ? (
        <View className="mb-3 px-4">
          <Card className="border-primary/30 bg-primary-soft">
            <CardBody className="gap-3">
              <View className="flex-row gap-3">
                <Icon name="bellOutline" size={20} color={colors.primary} />
                <View className="flex-1">
                  <Text variant="label" tone="primary">
                    {permission === 'denied'
                      ? t('notifications.blockedTitle')
                      : t('notifications.permissionTitle')}
                  </Text>
                  <Text variant="caption" tone="muted" className="mt-1">
                    {permission === 'denied'
                      ? t('notifications.blockedBody')
                      : t('notifications.permissionBody')}
                  </Text>
                </View>
              </View>
              <Button
                label={
                  permission === 'denied'
                    ? t('notifications.openSettings')
                    : t('notifications.enable')
                }
                size="sm"
                onPress={() => void enablePush()}
              />
            </CardBody>
          </Card>
        </View>
      ) : null}

      {query.isLoading ? (
        <View className="px-4">
          <ListSkeleton rows={5} />
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
          ListEmptyComponent={
            <EmptyState
              icon="bellOutline"
              title={t('notifications.empty.title')}
              body={t('notifications.empty.body')}
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
