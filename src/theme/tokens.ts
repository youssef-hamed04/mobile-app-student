/** Non-color design tokens shared by NativeWind classes and native code. */

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const fontSize = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

/** Minimum accessible touch target (iOS HIG 44pt / Material 48dp). */
export const MIN_TOUCH_TARGET = 48;

export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  banner: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  /** Watermark must sit above every player control. */
  watermark: 60,
  /** Privacy shield when the app is backgrounded / capture is detected. */
  shield: 100,
} as const;

export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  sm: {
    shadowColor: '#14131A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#14131A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 5,
  },
  lg: {
    shadowColor: '#14131A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 12,
  },
} as const;

/**
 * Outline weights.
 *
 * The brand mark builds depth from rule weight rather than blur, so these are
 * the deliberate steps: `hair` for incidental dividers, `rule` for card and
 * control edges, `plate` for the heavy badge outline on orange/light fills.
 */
export const strokeWidth = {
  hair: 1,
  rule: 2,
  plate: 3,
} as const;
