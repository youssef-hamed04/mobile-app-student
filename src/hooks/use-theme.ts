import { useMemo } from 'react';

import { type Palette, palettes, type ThemeName } from '@/theme/palette';
import { useThemeStore } from '@/store/theme-store';

export interface ThemeValue {
  name: ThemeName;
  isDark: boolean;
  colors: Palette;
}

/** Raw color values, for native surfaces that can't take a className. */
export function useTheme(): ThemeValue {
  const name = useThemeStore((s) => s.resolved);

  return useMemo(
    () => ({ name, isDark: name === 'dark', colors: palettes[name] }),
    [name]
  );
}
