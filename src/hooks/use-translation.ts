import { useTranslation as useI18nTranslation } from 'react-i18next';

import type { Language } from '@/store/language-store';
import { useLanguageStore } from '@/store/language-store';

/**
 * Thin wrapper so screens import from one place and get the RTL flag and the
 * active language alongside `t` without a second hook call.
 */
export function useTranslation() {
  const { t, i18n } = useI18nTranslation();
  const isRTL = useLanguageStore((s) => s.isRTL);
  const language = useLanguageStore((s) => s.language) as Language;

  return { t, i18n, isRTL, language };
}
