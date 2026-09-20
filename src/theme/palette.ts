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
 * Visual identity: "Student Center" mark
 * ---------------------------------------------------------------------------
 * The mark is a red cog-and-C on a flat amber plate — two colours, no
 * gradients, no outline. Both are sampled from the artwork: the plate is
 * #FBB150 and the ink is #D52027. Three rules follow and are encoded here:
 *
 *  1. Orange is a SURFACE, not a text colour. The plate against white is only
 *     1.8:1 — it fails WCAG AA outright. What gives the mark its punch is dark
 *     ink on amber (10.1:1). So `highlight` / `highlightFg` is the plate, and
 *     the much darker `primary` is what carries white text on buttons.
 *  2. The plate is amber (H34), not the coral orange it replaced. Every step
 *     of the brand ramp holds that hue, so a lighter or darker brand surface
 *     still reads as the same colour rather than drifting toward red.
 *  3. Depth comes from outline weight, not blur. `outline` is the near-black
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
  // Deliberately far darker than the plate: at this hue, white-on-amber only
  // clears WCAG AA (4.5:1) from about #AD6507 down. See __tests__/theme.test.ts.
  primary: '#A85F06',
  primaryFg: '#FFFFFF',
  primarySoft: '#FFF5E8',
  highlight: '#FBB150',
  highlightFg: '#14131A',
  // The mark's ink, unmodified — it clears AA with white on its own.
  accent: '#D52027',
  accentFg: '#FFFFFF',
  accentSoft: '#FFEDEE',
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
  // On a near-black ground the plate itself clears 9.9:1, so dark mode can use
  // the brand colour undiluted where light mode has to darken it.
  primary: '#FBB150',
  primaryFg: '#2A1206',
  primarySoft: '#3A2408',
  highlight: '#FBB150',
  highlightFg: '#14131A',
  accent: '#F44E54',
  accentFg: '#2B0709',
  accentSoft: '#3A1416',
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
  /** The plate colour, sampled from the mark's ground. */
  orange: '#FBB150',
  orangeDeep: '#F99B1F',
  orangeDark: '#A85F06',
  /** The ink colour, sampled from the cog and wordmark. */
  red: '#D52027',
  redDark: '#AF1D22',
  /** Readable as *text* on the plate (6.5:1), where `red` is only 2.8:1. */
  redDeep: '#700F13',
  white: '#FFFFFF',
  black: '#14131A',
} as const;
