// Since SDK 56 expo-router ships its own copy of the navigation theming
// primitives. Importing them from '@react-navigation/native' makes the Metro
// bundle fail ("expo-router is no longer compatible with react-navigation"),
// which broke every release build.
import * as NavigationBar from 'expo-navigation-bar';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { colorScheme as nativewindColorScheme } from 'nativewind';
import * as React from 'react';
import { Appearance, Platform } from 'react-native';

import { useThemeStore, watchSystemAppearance } from '@/store/theme-store';

import { palettes } from './palette';

/**
 * Single source of truth for "what does dark mode mean right now".
 *
 * FIVE systems have to agree, and each has its own API:
 *   1. NativeWind  — drives every `dark:` utility (className layer)
 *   2. React Navigation — header/card backgrounds during transitions
 *   3. The native root view — prevents a white flash behind the JS layer
 *      when pushing a screen or rotating
 *   4. The system bars — status bar content colour and the Android nav bar
 *   5. The platform appearance — what NATIVE views use for their own
 *      defaults: a TextInput's underlying EditText, its hint colour and
 *      selection handles, autofill dropdowns, date pickers, the iOS keyboard.
 *
 * (5) was the missing one, and it is the only part of the stack the JS layer
 * cannot style. `userInterfaceStyle: 'automatic'` in app.config.ts makes the
 * platform follow the OS, while the in-app preference lets a student choose
 * light or dark independently of it. When those two disagree — dark OS with
 * the app set to light, or the reverse — every native default is drawn for the
 * wrong theme while everything NativeWind controls is drawn for the right
 * one. On Android that shows up first in text fields, because RN's TextInput
 * is a native EditText: dark-theme defaults on a light surface give a field
 * whose text and hint are drawn near-black on near-black.
 *
 * `Appearance.setColorScheme` is the API that settles it, and it belongs here
 * with the other four rather than anywhere else.
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

  // 3 + 4 + 5. Native surfaces, and the platform appearance behind them.
  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);

    // Native views take their defaults from this, not from NativeWind. Set
    // to the app's RESOLVED theme, so `preference: 'system'` still follows
    // the OS while an explicit light/dark choice is honoured all the way
    // down. Without it the two layers disagree whenever the student's choice
    // differs from the OS, and text fields are where that shows first.
    Appearance.setColorScheme(resolved);

    if (Platform.OS === 'android') {
      void NavigationBar.setStyle(isDark ? 'dark' : 'light');
    }
  }, [colors.background, isDark, resolved]);

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
