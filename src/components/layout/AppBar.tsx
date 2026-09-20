import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { backChevron } from '@/i18n/direction';
import { useTranslation } from '@/hooks/use-translation';
import { useLanguageStore } from '@/store/language-store';
import { cn } from '@/utils/cn';

export interface AppBarProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Transparent variant for hero headers that scroll under the bar. */
  transparent?: boolean;
  /**
   * Sitting on the brand plate: no bar fill, and both lines inked dark. The
   * subtitle can't stay `muted` here — grey on orange is 3.4:1, under the
   * 4.5:1 a step counter needs.
   */
  onPlate?: boolean;
  className?: string;
}

/**
 * In-app header.
 *
 * A custom bar rather than the native stack header because several screens
 * need a two-line title with a progress bar underneath, and because the back
 * chevron has to mirror in RTL — which the native header does automatically
 * only when the whole app is force-RTL, and we support switching at runtime.
 */
export function AppBar({
  title,
  subtitle,
  showBack = true,
  onBack,
  right,
  transparent = false,
  onPlate = false,
  className,
}: AppBarProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useLanguageStore((s) => s.isRTL);

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      className={cn(
        'min-h-[56px] flex-row items-center gap-1 px-1',
        transparent || onPlate
          ? 'bg-transparent'
          : 'border-b border-border bg-surface',
        className
      )}
    >
      {showBack ? (
        <IconButton
          icon={backChevron(isRTL)}
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
          variant={transparent ? 'glass' : 'plain'}
        />
      ) : (
        <View className="w-3" />
      )}

      <View className="flex-1 px-1">
        {title ? (
          <Text
            variant="title"
            tone={onPlate ? 'onHighlight' : 'default'}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            variant="caption"
            numberOfLines={1}
            tone={onPlate ? undefined : 'muted'}
            className={onPlate ? 'text-brand-900' : undefined}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}
