// Since SDK 56 expo-router ships its own copy of the navigation theming
// primitives. Importing them from '@react-navigation/native' makes the Metro
// bundle fail ("expo-router is no longer compatible with react-navigation"),
// which broke every release build.
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { colorScheme as nativewindColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';

import { useThemeStore, watchSystemAppearance } from '@/store/theme-store';

import { palettes } from './palette';

/**
 * Single source of truth for "what does dark mode mean right now".
 *
 * Four systems have to agree, and each has its own API:
 *   1. NativeWind  — drives every `dark:` utility (className layer)
 *   2. React Navigation — header/card backgrounds during transitions
 *   3. The native root view — prevents a white flash behind the JS layer
 *      when pushing a screen or rotating
 *   4. The system bars — status bar content colour and the Android nav bar
 *
 * Keeping them in one effect means there is no window where the app is half
 * light and half dark, which is the usual symptom of syncing these separately.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const resolved = useThemeStore((s) => s.resolved);
  const colors = palettes[resolved];
  const isDark = resolved === 'dark';

  // Track the OS appearance so `preference: 'system'` stays live.
  React.useEffect(() => watchSystemAppearance(), []);

  // 1. NativeWind
  React.useEffect(() => {
    nativewindColorScheme.set(resolved);
  }, [resolved]);

  // 3 + 4. Native surfaces
  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);

    if (Platform.OS === 'android') {
      void NavigationBar.setStyle(isDark ? 'dark' : 'light');
    }
  }, [colors.background, isDark]);

  // 2. React Navigation
  const navTheme = React.useMemo(() => {
    const base = isDark ? NavDarkTheme : NavLightTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.foreground,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [isDark, colors]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </NavigationThemeProvider>
  );
}
