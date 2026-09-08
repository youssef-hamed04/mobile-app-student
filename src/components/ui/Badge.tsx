import * as React from 'react';
import { View } from 'react-native';

import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone =
  | 'neutral'
  | 'highlight'
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
  primary: { bg: 'bg-primary-soft border border-primary/30', fg: 'text-primary' },
  success: { bg: 'bg-success/12 border border-success/30', fg: 'text-success' },
  warning: { bg: 'bg-warning/12 border border-warning/30', fg: 'text-warning' },
  danger: { bg: 'bg-accent-soft border border-accent/30', fg: 'text-accent' },
  info: { bg: 'bg-info/12 border border-info/30', fg: 'text-info' },
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}

export function Badge({ label, tone = 'neutral', icon, className }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-full px-2.5 py-1',
        t.bg,
        className
      )}
    >
      {icon ? <Icon name={icon} size={12} className={t.fg} /> : null}
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
      style={{ height: 18 }}
    >
      <Text variant="overline" className="text-accent-fg" forceLatin>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}
