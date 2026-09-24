import { reloadAppAsync } from 'expo';
import * as React from 'react';
import { Alert, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { changeLanguage } from '@/i18n';
import { useTranslation } from '@/hooks/use-translation';
import { useTheme } from '@/hooks/use-theme';

/**
 * Compact AR ⇄ EN switch for the auth screens.
 *
 * Switching between an LTR and an RTL language changes a *native* layout
 * setting, which only takes full effect after the JS bundle reloads. Rather
 * than pretend otherwise, the toggle asks for confirmation and performs the
 * reload — that is a far better experience than a screen where half the
 * components are mirrored and half aren't.
 */
export function LanguageToggle() {
  const { t, language } = useTranslation();
  const { colors } = useTheme();

  const next = language === 'ar' ? 'en' : 'ar';
  const nextLabel = next === 'ar' ? 'العربية' : 'English';

  const onPress = async () => {
    const { restartRequired } = await changeLanguage(next);
    if (!restartRequired) return;

    Alert.alert(t('settings.restartNeeded'), t('settings.restartNeededBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.restartNow'),
        onPress: async () => {
          // reloadAppAsync works in every build type. Updates.reloadAsync
          // throws ERR_UPDATES_DISABLED whenever expo-updates is off, which
          // left the student on a half-mirrored layout after switching to
          // or from Arabic.
          await reloadAppAsync('Layout direction changed').catch(() => undefined);
        },
      },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('settings.language')}: ${nextLabel}`}
      onPress={onPress}
      hitSlop={10}
      // Only ever rendered on the auth plate, where a white pill is 1.8:1
      // against the orange — hence the hard rule rather than a hairline.
      className="h-10 flex-row items-center gap-1.5 rounded-full border-2 border-outline bg-surface px-3 active:bg-surface-alt"
    >
      <Icon name="language" size={16} color={colors.outline} />
      <Text variant="label" tone="onHighlight">
        {nextLabel}
      </Text>
    </Pressable>
  );
}
