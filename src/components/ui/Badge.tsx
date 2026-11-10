import * as React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone =
  | 'neutral'
  | 'highlight'
  | 'onPlate'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: 'bg-surface-alt border border-border', fg: 'text-muted' },
  // The brand mark's plate: orange fill, black ink, hard rule. Reads as a
  // stamp rather than a tint, which is what makes it carry across a busy card.
  highlight: { bg: 'bg-highlight border border-outline', fg: 'text-highlight-fg' },
  // For a badge sitting *on* the plate, where `highlight` would be orange on
  // orange. The surface flips with the theme and the ink follows it, so this
  // stays legible even though the plate underneath never changes.
  onPlate: { bg: 'bg-surface border-2 border-outline', fg: 'text-foreground' },
  primary: { bg: 'bg-primary-soft border border-primary/30', fg: 'text-primary' },
  // `/10` rather than `/12`: 12 is not on the opacity scale, so the class was
  // never generated and these badges had no fill at all.
  success: { bg: 'bg-success/10 border border-success/30', fg: 'text-success' },
  warning: { bg: 'bg-warning/10 border border-warning/30', fg: 'text-warning' },
  danger: { bg: 'bg-accent-soft border border-accent/30', fg: 'text-accent' },
  info: { bg: 'bg-info/10 border border-info/30', fg: 'text-info' },
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}

/**
 * A small status stamp.
 *
 * It no longer sets `self-start` on itself: inside a `flex-row items-center`
 * row that pinned the badge to the top edge of the row. A badge placed in a
 * column passes `className="self-start"` so it does not stretch.
 */
export function Badge({ label, tone = 'neutral', icon, className }: BadgeProps) {
  const { colors } = useTheme();
  const t = TONES[tone];
  // `Icon` takes a colour, not a class, so the badge's ink is resolved here.
  const iconColor: Record<BadgeTone, string> = {
    neutral: colors.muted,
    highlight: colors.highlightFg,
    onPlate: colors.foreground,
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.accent,
    info: colors.info,
  };
  return (
    <View
      className={cn('flex-row items-center gap-1 rounded-full px-2.5 py-1', t.bg, className)}
    >
      {icon ? <Icon name={icon} size={12} color={iconColor[tone]} /> : null}
      <Text variant="overline" className={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Small count bubble for tab bars and list rows. */
export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <View
      accessibilityLabel={label}
      className="min-w-[18px] items-center justify-center rounded-full bg-accent px-1"
      style={{ minHeight: 18 }}
    >
      <Text variant="overline" className="text-accent-fg" forceLatin maxFontSizeMultiplier={1.2}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}
