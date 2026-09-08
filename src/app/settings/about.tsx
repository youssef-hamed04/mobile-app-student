import * as Application from 'expo-application';
import * as React from 'react';
import { View } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { BrandMark } from '@/components/layout/BrandMark';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';

export default function AboutScreen() {
  const { t } = useTranslation();

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('settings.about')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-8">
        <View className="mb-8 items-center">
          <BrandMark size={120} />
          <Text variant="h3" className="mt-4">
            {t('common.appName')}
          </Text>
          <Text variant="caption" tone="muted" className="mt-1" forceLatin>
            {t('settings.version', { version: env.appVersion })} ·{' '}
            {t('settings.build', { build: Application.nativeBuildVersion ?? '—' })}
          </Text>
          <Text variant="caption" tone="subtle" className="mt-0.5" forceLatin>
            {env.env}
          </Text>
        </View>

        <ListSection>
          <ListItem
            icon="document"
            title={t('settings.terms')}
            showChevron
            onPress={() => void support.email({ reason: 'general' })}
          />
          <ListItem
            icon="shield"
            title={t('settings.privacy')}
            showChevron
            onPress={() => void support.email({ reason: 'general' })}
          />
          <ListItem
            icon="lock"
            title={t('settings.contentPolicy')}
            showChevron
            onPress={() => void support.email({ reason: 'general' })}
          />
        </ListSection>

        <ListSection title={t('settings.support')}>
          <ListItem
            icon="whatsapp"
            title={t('auth.whatsappSupport')}
            subtitle={env.support.whatsapp}
            showChevron
            onPress={() => void support.whatsapp({ reason: 'general' })}
          />
          <ListItem
            icon="mail"
            title={t('auth.emailSupport')}
            subtitle={env.support.email}
            showChevron
            onPress={() => void support.email({ reason: 'general' })}
          />
        </ListSection>
      </Screen>
    </Screen>
  );
}
