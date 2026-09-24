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

/**
 * Privacy policy and terms open the published pages when their URLs are
 * configured for the build (both stores require the privacy policy to be
 * reachable from inside the app); otherwise support is the fallback.
 */
async function openLegalOrSupport(page: 'privacyPolicy' | 'terms') {
  const opened = await support.openLegal(page);
  if (!opened) await support.email({ reason: 'general' });
}

export default function AboutScreen() {
  const { t } = useTranslation();

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('settings.about')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-8">
        <View className="mb-8 items-center">
          {/* The name is printed underneath, so the wordmark would repeat it. */}
          <BrandMark variant="mark" width={96} />
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
            onPress={() => void openLegalOrSupport('terms')}
          />
          <ListItem
            icon="shield"
            title={t('settings.privacy')}
            showChevron
            onPress={() => void openLegalOrSupport('privacyPolicy')}
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
