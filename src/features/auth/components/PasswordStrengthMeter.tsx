import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/utils/cn';

import { passwordStrength } from '../schemas';

const BAR_TONE = {
  weak: 'bg-accent',
  fair: 'bg-warning',
  good: 'bg-info',
  strong: 'bg-success',
} as const;

const TEXT_TONE = {
  weak: 'text-accent',
  fair: 'text-warning',
  good: 'text-info',
  strong: 'text-success',
} as const;

/*
 * On the brand plate every semantic tone above collapses: weak 2.8:1, fair
 * 2.8:1, strong 2.8:1, good 3.7:1 — none of them readable as text on orange.
 * These are the same four hues taken down until each clears 5.5:1, so the
 * meter still reads red→amber→blue→green rather than turning into one colour.
 */
const BAR_TONE_PLATE = {
  weak: 'bg-[#700F13]',
  fair: 'bg-[#5C3A04]',
  good: 'bg-[#12308A]',
  strong: 'bg-[#0B4A23]',
} as const;

const TEXT_TONE_PLATE = {
  weak: 'text-[#700F13]',
  fair: 'text-[#5C3A04]',
  good: 'text-[#12308A]',
  strong: 'text-[#0B4A23]',
} as const;

/**
 * Advisory only. The authoritative password policy is the Zod schema plus
 * whatever the backend enforces — this just gives the student feedback while
 * they type instead of a wall of errors on submit.
 */
export function PasswordStrengthMeter({
  value,
  onPlate = false,
}: {
  value: string;
  onPlate?: boolean;
}) {
  const { t } = useTranslation();

  if (!value) return null;

  const { score, level } = passwordStrength(value);
  const bar = onPlate ? BAR_TONE_PLATE : BAR_TONE;
  const text = onPlate ? TEXT_TONE_PLATE : TEXT_TONE;

  return (
    <View className="mt-1 gap-1.5" accessibilityLabel={t(`auth.passwordStrength.${level}`)}>
      <View className="flex-row gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < score
                ? bar[level]
                : onPlate
                  ? 'bg-outline/25'
                  : 'bg-surface-alt'
            )}
          />
        ))}
      </View>
      <Text variant="caption" className={text[level]}>
        {t(`auth.passwordStrength.${level}`)}
      </Text>
    </View>
  );
}
