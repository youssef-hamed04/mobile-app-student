import * as Updates from 'expo-updates';
import * as React from 'react';
import { Alert } from 'react-native';

import { AppBar } from '@/components/layout/AppBar';
import { ListItem, ListSection } from '@/components/ui/ListItem';
import { Screen } from '@/components/ui/Screen';
import { isDev } from '@/config/env';
import { changeLanguage } from '@/i18n';
import { useTranslation } from '@/hooks/use-translation';
import { type Language, SUPPORTED_LANGUAGES, useLanguageStore } from '@/store/language-store';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/use-theme';

const LABELS: Record<Language, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  ar: { native: 'العربية', english: 'Arabic' },
};

/**
 * Language picker.
 *
 * Switching between LTR and RTL flips a native layout flag that only fully
 * applies after a bundle reload, so the change is confirmed explicitly rather
 * than leaving the student on a half-mirrored screen.
 */
export default function LanguageScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const current = useLanguageStore((s) => s.language);

  const select = async (next: Language) => {
    if (next === current) return;

    const { restartRequired } = await changeLanguage(next);
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

  return (
    <Screen padded={false} edges={['top']}>
      <AppBar title={t('settings.language')} />

      <Screen hideNetworkBanner edges={[]} contentClassName="pt-4">
        <ListSection>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <ListItem
              key={lang}
              title={LABELS[lang].native}
              subtitle={LABELS[lang].english}
              onPress={() => void select(lang)}
              right={
                current === lang ? (
                  <Icon name="check" size={20} color={colors.primary} />
                ) : undefined
              }
            />
          ))}
        </ListSection>
      </Screen>
    </Screen>
  );
}
