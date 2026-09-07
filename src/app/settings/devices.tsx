import * as React from 'react';
import { View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuthorizedDevices, useRequestDeviceChange } from '@/features/auth/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { getDeviceIdentity, type DeviceIdentity } from '@/services/device';
import { support } from '@/services/support';
import { toast } from '@/store/ui-store';
import { formatRelative } from '@/utils/format';

/**
 * Device binding.
 *
 * The client never decides whether this device is authorized — it displays
 * whatever the backend reports and offers the request path. Moving an account
 * to a new handset is an administrative action by design (spec §36).
 */
export default function DevicesScreen() {
  const { t, language } = useTranslation();
  const { colors } = useTheme();

  const [identity, setIdentity] = React.useState<DeviceIdentity | null>(null);
  const devices = useAuthorizedDevices();
  const requestChange = useRequestDeviceChange();

  React.useEffect(() => {
    void getDeviceIdentity().then(setIdentity);
  }, []);

  const submitRequest = async () => {
    try {
      await requestChange.mutateAsync(
        `Requested from ${identity?.name ?? 'unknown device'}`
      );
      toast.success(t('settings.requestSent'));
    } catch {
      void support.whatsapp({ reason: 'device' });
    }
  };

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('devices.title')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-4">
        <Card className="mb-4">
          <CardBody className="gap-3">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-soft">
                <Icon name="device" size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text variant="label">{t('settings.currentDevice')}</Text>
                <Text variant="caption" tone="muted" className="mt-0.5" numberOfLines={1}>
                  {identity ? `${identity.manufacturer} ${identity.model}` : '—'}
                </Text>
              </View>
              {identity?.integritySuspect ? (
                <Badge label={t('security.integrityTitle')} tone="danger" />
              ) : null}
            </View>

            {identity ? (
              <Text variant="caption" tone="subtle" forceLatin numberOfLines={1}>
                {identity.platform} {identity.osVersion} · {identity.deviceId.slice(0, 12)}…
              </Text>
            ) : null}
          </CardBody>
        </Card>

        {devices.isLoading ? (
          <ListSkeleton rows={2} />
        ) : devices.isError ? (
          <ErrorState error={devices.error} onRetry={() => void devices.refetch()} compact />
        ) : (
          <View className="gap-3">
            {(devices.data ?? []).map((d) => (
              <Card key={d.id}>
                <CardBody className="flex-row items-center gap-3">
                  <Icon name="device" size={20} color={colors.muted} />
                  <View className="flex-1">
                    <Text variant="label">{d.name}</Text>
                    <Text variant="caption" tone="muted">
                      {d.model} · {d.platform}
                    </Text>
                    <Text variant="caption" tone="subtle" className="mt-0.5">
                      {t('settings.lastSeen', {
                        date: formatRelative(d.lastSeenAt, language),
                      })}
                    </Text>
                  </View>
                  {d.current ? (
                    <Badge label={t('settings.currentDevice')} tone="primary" />
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </View>
        )}

        <Card className="mt-6">
          <CardBody className="gap-3">
            <Text variant="label">{t('settings.requestDeviceChange')}</Text>
            <Text variant="caption" tone="muted">
              {t('settings.requestDeviceChangeBody')}
            </Text>
            <Button
              label={t('settings.requestDeviceChange')}
              variant="secondary"
              fullWidth
              loading={requestChange.isPending}
              onPress={() => void submitRequest()}
            />
            <Button
              label={t('settings.contactSupport')}
              variant="link"
              fullWidth
              onPress={() => void support.whatsapp({ reason: 'device' })}
            />
          </CardBody>
        </Card>
      </Screen>
    </Screen>
  );
}
