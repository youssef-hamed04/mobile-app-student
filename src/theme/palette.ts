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
 *
 * ---------------------------------------------------------------------------
 * Visual identity: "Student Center" badge
 * ---------------------------------------------------------------------------
 * The brand mark is a hard-edged black badge with an orange plate and heavy
 * black outlines. Two rules follow from it and are encoded here:
 *
 *  1. Orange is a SURFACE, not a text colour. The mark's orange (#FF914C)
 *     paired with white is only ~2.3:1 — it fails WCAG AA outright. What
 *     actually gives the badge its punch is black ink on orange (~8:1). So
 *     `highlight` / `highlightFg` is the orange plate, and the darker
 *     `primary` stays the colour that carries white text on buttons.
 *  2. Depth comes from outline weight, not blur. `outline` is the near-black
 *     rule used on orange/light fills; see `elevation` in tokens.ts for the
 *     matching hard, low-blur shadows.
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  /** Near-black hard rule. For orange/light fills — never on a dark surface. */
  outline: string;
  foreground: string;
  muted: string;
  subtle: string;
  primary: string;
  primaryFg: string;
  primarySoft: string;
  /** The brand mark's orange plate. Always paired with `highlightFg`. */
  highlight: string;
  highlightFg: string;
  accent: string;
  accentFg: string;
  accentSoft: string;
  success: string;
  warning: string;
  info: string;
  disabled: string;
  disabledFg: string;
  overlay: string;
}

export const lightPalette: Palette = {
  // Warm paper rather than pure white, so white cards read as raised plates
  // against it — the badge-on-ground relationship from the mark.
  background: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEDE8',
  surfaceRaised: '#FFFFFF',
  border: '#E2DED6',
  borderStrong: '#C3BDB1',
  outline: '#14131A',
  foreground: '#121114',
  muted: '#63615C',
  subtle: '#8E8B84',
  // Deliberately a shade darker than the mark's orange: white-on-orange only
  // clears WCAG AA (4.5:1) from about #C94A0A down. See __tests__/theme.test.ts.
  primary: '#C94A0A',
  primaryFg: '#FFFFFF',
  primarySoft: '#FFF1E4',
  highlight: '#FF914C',
  highlightFg: '#14131A',
  accent: '#C01F1F',
  accentFg: '#FFFFFF',
  accentSoft: '#FFEFEF',
  success: '#15803D',
  warning: '#B45309',
  info: '#1D4ED8',
  disabled: '#E4E0D8',
  disabledFg: '#8E8B84',
  overlay: '#14131A',
};

export const darkPalette: Palette = {
  background: '#0C0B0E',
  surface: '#16151A',
  surfaceAlt: '#1D1C22',
  surfaceRaised: '#26242C',
  border: '#302E38',
  borderStrong: '#4C4A56',
  // Stays near-black: `outline` is only ever drawn on an orange or light
  // fill, which keeps the badge treatment identical in both themes.
  outline: '#0A090C',
  foreground: '#F7F6F4',
  muted: '#ABA8B0',
  subtle: '#7E7B86',
  // Lifted from the light-mode primary to hold contrast on dark surfaces.
  primary: '#FF9147',
  primaryFg: '#1A0D03',
  primarySoft: '#2E1C10',
  highlight: '#FF914C',
  highlightFg: '#14131A',
  accent: '#F65A5A',
  accentFg: '#200808',
  accentSoft: '#341818',
  success: '#4ADE80',
  warning: '#FBBF24',
  info: '#7DAFFF',
  disabled: '#26242C',
  disabledFg: '#6B6874',
  overlay: '#000000',
};

export const palettes: Record<ThemeName, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** Brand colors that never change between themes. */
export const brand = {
  /** The plate colour lifted from the brand mark. */
  orange: '#FF914C',
  orangeDeep: '#F26A1B',
  orangeDark: '#C94A0A',
  red: '#E0322F',
  redDark: '#C01F1F',
  white: '#FFFFFF',
  black: '#14131A',
} as const;
