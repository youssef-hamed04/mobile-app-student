import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { setApiLanguage } from '@/api/client';
import { createLogger } from '@/services/logger';
import {
  type Language,
  SUPPORTED_LANGUAGES,
  isRTLLanguage,
  useLanguageStore,
} from '@/store/language-store';

import ar from './locales/ar.json';
import en from './locales/en.json';

const log = createLogger('i18n');

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
} as const;

export type TranslationKeys = typeof en;

/** Device locale narrowed to a language we actually ship. */
export function detectDeviceLanguage(): Language {
  const tags = Localization.getLocales();
  for (const l of tags) {
    const code = l.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as Language;
    }
  }
  return 'en';
}

let initialized = false;

export async function initI18n(): Promise<Language> {
  const state = useLanguageStore.getState();
  const language: Language = state.explicit ? state.language : detectDeviceLanguage();

  if (!initialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      defaultNS: 'translation',
      interpolation: {
        // React already escapes.
        escapeValue: false,
      },
      returnNull: false,
      compatibilityJSON: 'v4',
      react: { useSuspense: false },
      // Surface missing keys loudly in development instead of shipping
      // an English string into an Arabic screen unnoticed.
      saveMissing: __DEV__,
      missingKeyHandler: (_lngs, _ns, key) => {
        if (__DEV__) log.warn('missing translation key', { key });
      },
    });
    initialized = true;
  } else {
    await i18n.changeLanguage(language);
  }

  useLanguageStore.getState().hydrate(language, state.explicit);
  setApiLanguage(language);
  applyDirection(language);

  return language;
}

/**
 * RTL handling.
 *
 * React Native's layout direction is a *native* setting: flipping it only
 * takes full effect after the JS bundle reloads. We therefore:
 *   1. always keep I18nManager in sync, and
 *   2. tell the caller whether a reload is required so the UI can offer a
 *      "restart now" action instead of silently rendering a broken layout.
 */
export function applyDirection(language: Language): { restartRequired: boolean } {
  const shouldBeRTL = isRTLLanguage(language);

  I18nManager.allowRTL(shouldBeRTL);

  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    log.info('layout direction changed', { shouldBeRTL });
    return { restartRequired: true };
  }

  return { restartRequired: false };
}

export async function changeLanguage(language: Language) {
  useLanguageStore.getState().setLanguage(language);
  await i18n.changeLanguage(language);
  setApiLanguage(language);
  return applyDirection(language);
}

export { i18n };
export default i18n;
