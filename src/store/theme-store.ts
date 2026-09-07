import { Appearance } from 'react-native';
import { create } from 'zustand';

import { kv, KvKeys } from '@/services/kv';
import type { ThemeName } from '@/theme/palette';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  /** OS-level scheme; kept in state so resolution is a pure selector. */
  systemScheme: ThemeName;
  resolved: ThemeName;
  setPreference: (p: ThemePreference) => void;
  setSystemScheme: (s: ThemeName) => void;
}

function readStoredPreference(): ThemePreference {
  const raw = kv.getString(KvKeys.theme);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

function resolve(pref: ThemePreference, system: ThemeName): ThemeName {
  return pref === 'system' ? system : pref;
}

const initialPreference = readStoredPreference();
const initialSystem: ThemeName = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  systemScheme: initialSystem,
  resolved: resolve(initialPreference, initialSystem),

  setPreference: (preference) => {
    kv.set(KvKeys.theme, preference);
    set({ preference, resolved: resolve(preference, get().systemScheme) });
  },

  setSystemScheme: (systemScheme) =>
    set({ systemScheme, resolved: resolve(get().preference, systemScheme) }),
}));

/** Subscribe once at app start. Returns an unsubscribe function. */
export function watchSystemAppearance() {
  const sub = Appearance.addChangeListener(({ colorScheme }) => {
    useThemeStore.getState().setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
  });
  return () => sub.remove();
}
