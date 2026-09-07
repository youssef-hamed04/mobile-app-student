/**
 * Typed mirror of the CSS variables in global.css.
 *
 * NativeWind classes are the primary styling mechanism; this object exists for
 * the places that need raw color values: the native status/navigation bar,
 * gradients, SVG icons, react-navigation theming, Skia/canvas surfaces and
 * the video player chrome.
 *
 * Keep this file and global.css in sync — the test in
 * __tests__/theme.test.ts asserts both define the same token set.
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  foreground: string;
  muted: string;
  subtle: string;
  primary: string;
  primaryFg: string;
  primarySoft: string;
  accent: string;
  accentFg: string;
  accentSoft: string;
  success: string;
  warning: string;
  info: string;
  overlay: string;
}

export const lightPalette: Palette = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F7F8',
  surfaceRaised: '#FFFFFF',
  border: '#E1E1E5',
  borderStrong: '#C8C8CF',
  foreground: '#101014',
  muted: '#6E6E7A',
  subtle: '#9A9AA5',
  // Deliberately a shade darker than brand-500: white-on-orange only clears
  // WCAG AA (4.5:1) from about #C94A0A down. Verified in __tests__/theme.test.ts.
  primary: '#C94A0A',
  primaryFg: '#FFFFFF',
  primarySoft: '#FFF4EC',
  accent: '#C01F1F',
  accentFg: '#FFFFFF',
  accentSoft: '#FFF1F1',
  success: '#15803D',
  warning: '#B45309',
  info: '#1D4ED8',
  overlay: '#0B0B0D',
};

export const darkPalette: Palette = {
  background: '#0B0B0D',
  surface: '#14141A',
  surfaceAlt: '#1A1A20',
  surfaceRaised: '#22222A',
  border: '#2E2E37',
  borderStrong: '#4A4A55',
  foreground: '#F7F7F8',
  muted: '#A8A8B2',
  subtle: '#7A7A86',
  primary: '#FB8038',
  primaryFg: '#1A0C03',
  primarySoft: '#2C1B11',
  accent: '#F65A5A',
  accentFg: '#200808',
  accentSoft: '#301616',
  success: '#4ADE80',
  warning: '#FBBF24',
  info: '#7DAFFF',
  overlay: '#000000',
};

export const palettes: Record<ThemeName, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** Brand colors that never change between themes. */
export const brand = {
  orange: '#F26A1B',
  orangeDark: '#D9520C',
  red: '#E0322F',
  redDark: '#C01F1F',
  white: '#FFFFFF',
  black: '#0B0B0D',
} as const;
