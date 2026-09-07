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

/**
 * Advisory only. The authoritative password policy is the Zod schema plus
 * whatever the backend enforces — this just gives the student feedback while
 * they type instead of a wall of errors on submit.
 */
export function PasswordStrengthMeter({ value }: { value: string }) {
  const { t } = useTranslation();

  if (!value) return null;

  const { score, level } = passwordStrength(value);

  return (
    <View className="mt-1 gap-1.5" accessibilityLabel={t(`auth.passwordStrength.${level}`)}>
      <View className="flex-row gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < score ? BAR_TONE[level] : 'bg-surface-alt'
            )}
          />
        ))}
      </View>
      <Text variant="caption" className={TEXT_TONE[level]}>
        {t(`auth.passwordStrength.${level}`)}
      </Text>
    </View>
  );
}
