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
  | 'onHighlight';

const VARIANTS: Record<TextVariant, string> = {
  display: 'text-4xl font-heading leading-[42px]',
  h1: 'text-3xl font-heading leading-9',
  h2: 'text-2xl font-heading leading-8',
  h3: 'text-xl font-heading leading-7',
  title: 'text-lg font-heading leading-6',
  body: 'text-base leading-6',
  bodyStrong: 'text-base font-heading leading-6',
  caption: 'text-sm leading-5',
  label: 'text-sm font-heading leading-5',
  overline: 'text-2xs uppercase tracking-[1.5px] font-heading',
  mono: 'text-sm',
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
};

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
 * Two things it centralises:
 *  1. Arabic uses a different family with taller line heights — set once here
 *     instead of in every screen.
 *  2. `text-start` (a logical property) rather than `text-left`, so alignment
 *     flips with the layout direction without any conditional code.
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

  return (
    <RNText
      ref={ref}
      className={cn(
        VARIANTS[variant],
        TONES[tone],
        'text-start',
        useArabicFace ? 'font-arabic' : 'font-sans',
        className
      )}
      style={[useArabicFace ? { lineHeight: undefined } : null, style]}
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
