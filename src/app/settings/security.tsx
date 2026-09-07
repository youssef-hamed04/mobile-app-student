import { capabilities } from '@modules/content-protection';
import * as React from 'react';
import { View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useProtectionState } from '@/hooks/use-content-protection';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';

/**
 * Privacy and security.
 *
 * Doubles as a transparency screen and a diagnostic one: it tells the student
 * in plain language what is protected and why, and shows the live protection
 * status so support can ask "what does that screen say?" instead of guessing.
 */
export default function SecurityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = useProtectionState();

  const items: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'shield',
      title: t('security.protectedContentTitle'),
      body: t('security.protectedContentBody'),
    },
    {
      icon: 'device',
      title: t('security.deviceBindingTitle'),
      body: t('security.deviceBindingBody'),
    },
    {
      icon: 'eye',
      title: t('security.watermarkTitle'),
      body: t('security.watermarkBody'),
    },
  ];

  const statusTone = state.available ? 'success' : 'danger';

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('security.title')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-4">
        <Card className="mb-6">
          <CardBody className="gap-3">
            <View className="flex-row items-center gap-3">
              <Icon
                name={state.available ? 'shield' : 'shieldAlert'}
                size={24}
                color={state.available ? colors.success : colors.accent}
              />
              <View className="flex-1">
                <Text variant="label">{t('security.protectedContentTitle')}</Text>
                <Text variant="caption" tone="muted" className="mt-0.5">
                  {capabilities.platform} ·{' '}
                  {capabilities.supportsSecureSurface ? 'secure surface' : 'unavailable'}
                </Text>
              </View>
              <Badge
                label={state.available ? t('common.yes') : t('common.no')}
                tone={statusTone}
              />
            </View>

            <View className="gap-1.5">
              <Signal
                label="Screenshot protection"
                on={capabilities.supportsSecureFlag || capabilities.supportsSecureSurface}
              />
              <Signal label="Capture detection" on={capabilities.supportsCaptureDetection} />
              <Signal
                label="Recording detection"
                on={capabilities.supportsRecordingDetection}
              />
              <Signal label="External display clear" on={!state.externalDisplay} />
              <Signal label="Device integrity" on={!state.integrityFailed} />
            </View>
          </CardBody>
        </Card>

        {items.map((item) => (
          <Card key={item.title} className="mb-3">
            <CardBody className="flex-row gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-md bg-primary-soft">
                <Icon name={item.icon} size={19} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text variant="label">{item.title}</Text>
                <Text variant="caption" tone="muted" className="mt-1">
                  {item.body}
                </Text>
              </View>
            </CardBody>
          </Card>
        ))}

        <View className="mt-4">
          <ListSection title={t('security.reportTitle')} footer={t('security.reportBody')}>
            <ListItem
              icon="whatsapp"
              title={t('settings.contactSupport')}
              showChevron
              onPress={() => void support.whatsapp({ reason: 'general' })}
            />
          </ListSection>
        </View>
      </Screen>
    </Screen>
  );
}

function Signal({ label, on }: { label: string; on: boolean }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-2">
      <Icon
        name={on ? 'checkCircle' : 'error'}
        size={14}
        color={on ? colors.success : colors.warning}
      />
      <Text variant="caption" tone="muted" forceLatin>
        {label}
      </Text>
    </View>
  );
}
