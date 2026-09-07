import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import * as React from 'react';
import { Alert } from 'react-native';

import { resetQueryCache } from '@/api/query-client';
import { AppBar } from '@/components/layout/AppBar';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { env, isDev } from '@/config/env';
import { changeLanguage } from '@/i18n';
import { useTranslation } from '@/hooks/use-translation';
import { support } from '@/services/support';
import { type ThemePreference, useThemeStore } from '@/store/theme-store';
import { toast } from '@/store/ui-store';
import { useLanguageStore, type Language } from '@/store/language-store';
import { Sheet } from '@/components/ui/Sheet';
import { Select } from '@/components/ui/Select';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const language = useLanguageStore((s) => s.language);

  const [themeSheet, setThemeSheet] = React.useState(false);

  const themeLabel = t(
    themePreference === 'system'
      ? 'settings.themeSystem'
      : themePreference === 'light'
        ? 'settings.themeLight'
        : 'settings.themeDark'
  );

  const switchLanguage = async (next: Language) => {
    if (next === language) return;

    const { restartRequired } = await changeLanguage(next);
    toast.success(t('settings.languageChanged'));

    if (!restartRequired) return;

    Alert.alert(t('settings.restartNeeded'), t('settings.restartNeededBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.restartNow'),
        onPress: async () => {
          if (isDev) return;
          await Updates.reloadAsync();
        },
      },
    ]);
  };

  const clearCache = () => {
    Alert.alert(t('settings.clearCache'), t('settings.storage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          await resetQueryCache();
          queryClient.clear();
          toast.success(t('settings.cacheCleared'));
        },
      },
    ]);
  };

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('settings.title')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-4">
        <ListSection title={t('settings.appearance')}>
          <ListItem
            icon="moon"
            title={t('settings.theme')}
            value={themeLabel}
            showChevron
            onPress={() => setThemeSheet(true)}
          />
          <ListItem
            icon="language"
            title={t('settings.language')}
            value={language === 'ar' ? 'العربية' : 'English'}
            showChevron
            onPress={() => router.push('/settings/language')}
          />
        </ListSection>

        <ListSection title={t('settings.playback')}>
          <ListItem
            icon="quality"
            title={t('settings.playback')}
            subtitle={t('settings.dataSaverBody')}
            showChevron
            onPress={() => router.push('/settings/playback')}
          />
        </ListSection>

        <ListSection title={t('settings.notifications')}>
          <ListItem
            icon="bellOutline"
            title={t('settings.pushNotifications')}
            showChevron
            onPress={() => router.push('/settings/notifications')}
          />
        </ListSection>

        <ListSection title={t('settings.account')}>
          <ListItem
            icon="shield"
            title={t('security.title')}
            subtitle={t('settings.securityBody')}
            showChevron
            onPress={() => router.push('/settings/security')}
          />
          <ListItem
            icon="device"
            title={t('settings.authorizedDevice')}
            showChevron
            onPress={() => router.push('/settings/devices')}
          />
        </ListSection>

        <ListSection title={t('settings.support')}>
          <ListItem
            icon="whatsapp"
            title={t('settings.contactSupport')}
            showChevron
            onPress={() => void support.whatsapp({ reason: 'general' })}
          />
          <ListItem
            icon="info"
            title={t('settings.aboutApp')}
            showChevron
            onPress={() => router.push('/settings/about')}
          />
        </ListSection>

        <ListSection
          title={t('settings.storage')}
          footer={`${t('settings.version', { version: env.appVersion })} · ${env.env}`}
        >
          <ListItem icon="trash" title={t('settings.clearCache')} onPress={clearCache} />
        </ListSection>
      </Screen>

      <Sheet
        visible={themeSheet}
        onClose={() => setThemeSheet(false)}
        title={t('settings.theme')}
        scrollable={false}
      >
        <Select
          label={t('settings.theme')}
          value={themePreference}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
          onChange={(v) => {
            setThemePreference(v as ThemePreference);
            setThemeSheet(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}
