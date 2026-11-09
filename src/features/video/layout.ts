/**
 * Geometry of the protected player, as pure functions so the layout rules can
 * be tested on every phone size without rendering a native player.
 */

/** Fraction of the screen height the portrait picture band may use. */
export const PORTRAIT_BAND_MAX_RATIO = 0.56;

/** Shapes a lecture can plausibly be, square to ultra-wide. */
export const MIN_ASPECT = 1;
export const MAX_ASPECT = 2.4;
export const DEFAULT_ASPECT = 16 / 9;

/** Clamp a reported track size to a usable aspect ratio, or null if it is nonsense. */
export function aspectFromTrack(size: { width: number; height: number } | null | undefined): number | null {
  if (!size || !(size.width > 0) || !(size.height > 0)) return null;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, size.width / size.height));
}

/**
 * The picture surface for a given screen.
 *
 *   immersive (fullscreen, or the phone held sideways): the whole screen.
 *   portrait: as wide as the screen and as tall as the source's shape allows,
 *   capped at `PORTRAIT_BAND_MAX_RATIO` of the height so the header and the
 *   control dock always fit. A tall source is capped by height and centred,
 *   with bars at the sides. Nothing is ever cropped.
 */
export function surfaceFor(params: {
  width: number;
  height: number;
  immersive: boolean;
  aspect: number | null;
}): { width: number; height: number } {
  const { width, height, immersive } = params;
  if (immersive) return { width, height };

  const aspect = params.aspect ?? DEFAULT_ASPECT;
  const bandCap = Math.round(height * PORTRAIT_BAND_MAX_RATIO);
  const bandHeight = Math.min(Math.round(width / aspect), bandCap);
  const bandWidth = Math.min(width, Math.round(bandHeight * aspect));
  return { width: bandWidth, height: bandHeight };
}

/** Immersive when the user asked for fullscreen OR the phone is held sideways. */
export function isImmersive(params: { width: number; height: number; fullscreen: boolean }): boolean {
  return params.fullscreen || params.width > params.height;
}
