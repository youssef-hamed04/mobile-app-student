import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useLanguageStore } from '@/store/language-store';
import { cn } from '@/utils/cn';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'overline'
  | 'mono';

export type TextTone =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'inverse'
  /** Black ink for use on a `highlight` (orange plate) surface. */
  | 'onHighlight'
  /**
   * No colour class: the caller's `className` sets it. A tone class and a colour
   * in `className` have equal weight, and the one later in the stylesheet wins,
   * not the one later in the list. So in dark mode `text-foreground` beat a fixed
   * ink such as `text-brand-900`, drawing near-white text on the orange plate.
   *
   * Callers rarely need to say this any more: a `text-<colour>` class in
   * `className` drops the tone class automatically (see `carriesColour`).
   */
  | 'none';

/**
 * Size, weight and line height per variant. Line heights are explicit so a
 * row of mixed scripts shares one rhythm and a fixed-height container centres
 * its text instead of leaving it to the font's natural metrics.
 */
const VARIANTS: Record<TextVariant, { size: string; heading: boolean; leading: string; arabicLeading: string; extra?: string }> = {
  display: { size: 'text-4xl', heading: true, leading: 'leading-[42px]', arabicLeading: 'leading-[52px]' },
  h1: { size: 'text-3xl', heading: true, leading: 'leading-9', arabicLeading: 'leading-[44px]' },
  h2: { size: 'text-2xl', heading: true, leading: 'leading-8', arabicLeading: 'leading-[38px]' },
  h3: { size: 'text-xl', heading: true, leading: 'leading-7', arabicLeading: 'leading-8' },
  title: { size: 'text-lg', heading: true, leading: 'leading-6', arabicLeading: 'leading-7' },
  body: { size: 'text-base', heading: false, leading: 'leading-6', arabicLeading: 'leading-7' },
  bodyStrong: { size: 'text-base', heading: true, leading: 'leading-6', arabicLeading: 'leading-7' },
  caption: { size: 'text-sm', heading: false, leading: 'leading-5', arabicLeading: 'leading-6' },
  label: { size: 'text-sm', heading: true, leading: 'leading-5', arabicLeading: 'leading-6' },
  // `uppercase` and letter-spacing are Latin devices: spacing visibly breaks
  // the joins of cursive Arabic, so both are dropped for the Arabic face.
  overline: { size: 'text-2xs', heading: true, leading: 'leading-4', arabicLeading: 'leading-5', extra: 'uppercase tracking-[1.5px]' },
  mono: { size: 'text-sm', heading: false, leading: 'leading-5', arabicLeading: 'leading-6' },
};

const TONES: Record<TextTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted',
  subtle: 'text-subtle',
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  inverse: 'text-primary-fg',
  onHighlight: 'text-highlight-fg',
  none: '',
};

/**
 * True when `className` already sets a text colour. `text-` is also the
 * prefix for alignment (`text-start`), size (`text-sm`) and arbitrary values,
 * which are excluded, so only a colour utility counts.
 */
export function carriesColour(className: string | undefined): boolean {
  if (!className) return false;
  return /(?:^|\s)text-(?!(?:start|end|center|left|right|justify|xs|sm|base|lg|xl|2xl|3xl|4xl|2xs|\[)(?:\s|$|\/))[a-z]/.test(
    className
  );
}

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
  /**
   * Set for content that is always the same script regardless of UI language
   * (a timecode, a course code). Prevents the Arabic font from being applied
   * to latin-only strings.
   */
  forceLatin?: boolean;
  children?: React.ReactNode;
}

/**
 * Typography primitive.
 *
 * Three things it centralises:
 *  1. Arabic uses a different family (Cairo, Cairo-SemiBold for headings) with
 *     taller line heights — set once here instead of in every screen.
 *  2. `text-start` (a logical property) rather than `text-left`, so alignment
 *     flips with the layout direction without any conditional code.
 *  3. The tone colour yields to a colour class in `className`, so white text
 *     on a dark surface stays white in both themes.
 */
export const Text = React.forwardRef<RNText, TextProps>(function Text(
  {
    variant = 'body',
    tone = 'default',
    className,
    forceLatin = false,
    style,
    ...rest
  },
  ref
) {
  const isArabic = useLanguageStore((s) => s.language === 'ar');
  const useArabicFace = isArabic && !forceLatin;
  const v = VARIANTS[variant];

  const family = useArabicFace
    ? v.heading
      ? 'font-arabic-heading'
      : 'font-arabic'
    : v.heading
      ? 'font-heading'
      : 'font-sans';

  return (
    <RNText
      ref={ref}
      className={cn(
        v.size,
        useArabicFace ? v.arabicLeading : v.leading,
        !useArabicFace && v.extra,
        carriesColour(className) ? '' : TONES[tone],
        'text-start',
        family,
        className
      )}
      // Android adds font padding above and below the line box, which pushes
      // text off-centre in a fixed-height row; the explicit line height is
      // the whole rhythm, so the padding is dropped.
      style={[{ includeFontPadding: false }, style]}
      // Respect the OS font-size setting but keep layouts from exploding.
      maxFontSizeMultiplier={variant === 'display' || variant === 'h1' ? 1.4 : 1.8}
      {...rest}
    />
  );
});

/** Convenience wrappers so screens read declaratively. */
export const Heading = (p: Omit<TextProps, 'variant'> & { level?: 1 | 2 | 3 }) => (
  <Text variant={p.level === 3 ? 'h3' : p.level === 2 ? 'h2' : 'h1'} {...p} />
);

export const Caption = (p: Omit<TextProps, 'variant'>) => (
  <Text variant="caption" tone="muted" {...p} />
);
