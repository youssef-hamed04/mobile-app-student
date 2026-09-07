import { create } from 'zustand';

import { kv, KvKeys } from '@/services/kv';

export type Language = 'en' | 'ar';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'ar'] as const;

/** Languages that require a right-to-left layout. */
export const RTL_LANGUAGES: readonly Language[] = ['ar'] as const;

interface LanguageState {
  language: Language;
  /** True once the user has explicitly chosen (vs. inheriting device locale). */
  explicit: boolean;
  isRTL: boolean;
  setLanguage: (l: Language) => void;
  hydrate: (l: Language, explicit: boolean) => void;
}

function stored(): { language: Language | null; explicit: boolean } {
  const raw = kv.getString(KvKeys.language);
  if (raw === 'en' || raw === 'ar') return { language: raw, explicit: true };
  return { language: null, explicit: false };
}

const init = stored();

export const useLanguageStore = create<LanguageState>((set) => ({
  language: init.language ?? 'en',
  explicit: init.explicit,
  isRTL: RTL_LANGUAGES.includes(init.language ?? 'en'),

  setLanguage: (language) => {
    kv.set(KvKeys.language, language);
    set({ language, explicit: true, isRTL: RTL_LANGUAGES.includes(language) });
  },

  hydrate: (language, explicit) =>
    set({ language, explicit, isRTL: RTL_LANGUAGES.includes(language) }),
}));

export const isRTLLanguage = (l: Language) => RTL_LANGUAGES.includes(l);
