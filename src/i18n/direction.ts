import { I18nManager } from 'react-native';

import { useLanguageStore } from '@/store/language-store';

/**
 * Direction helpers.
 *
 * Prefer NativeWind logical utilities (ms-*, me-*, ps-*, pe-*, text-start,
 * text-end) — they flip automatically. These helpers exist for the cases the
 * style system can't express: icon glyph choice, animation vectors, gesture
 * directions and transform values.
 */

export function useIsRTL(): boolean {
  return useLanguageStore((s) => s.isRTL);
}

/** Native layout direction, which can lag the store until the app reloads. */
export const nativeIsRTL = () => I18nManager.isRTL;

/** +1 in LTR, -1 in RTL. Multiply translateX / velocity by this. */
export function directionSign(isRTL: boolean): 1 | -1 {
  return isRTL ? -1 : 1;
}

/** Chevron that always points "forward" (deeper into the stack). */
export function forwardChevron(isRTL: boolean): 'chevron-left' | 'chevron-right' {
  return isRTL ? 'chevron-left' : 'chevron-right';
}

/** Chevron that always points "back". */
export function backChevron(isRTL: boolean): 'chevron-left' | 'chevron-right' {
  return isRTL ? 'chevron-right' : 'chevron-left';
}

/**
 * Video transport controls must NOT mirror: "seek forward" is always the
 * right-hand control because the timeline itself is not mirrored.
 */
export const TRANSPORT_NEVER_MIRRORS = true;

/** Wrap a string in bidi isolation so numbers/latin don't reorder in Arabic. */
export function bidiIsolate(value: string | number): string {
  return `⁨${value}⁩`;
}
