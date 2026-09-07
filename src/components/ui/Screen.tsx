import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  View,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/utils/cn';

import { NetworkBanner } from '../feedback/NetworkBanner';

export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Use false for FlashList-based screens. */
  scroll?: boolean;
  /** Pull-to-refresh handler; enables RefreshControl when provided. */
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: readonly Edge[];
  className?: string;
  contentClassName?: string;
  /** Adds standard horizontal gutters. */
  padded?: boolean;
  /** Hides the global offline banner (e.g. inside the fullscreen player). */
  hideNetworkBanner?: boolean;
  keyboardAvoiding?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'children'>;
  /** Sticky footer (primary action bars). */
  footer?: React.ReactNode;
}

/**
 * Screen shell.
 *
 * Handles the four things every screen otherwise re-implements: safe areas,
 * the offline banner, keyboard avoidance and pull-to-refresh — with the theme
 * colours already applied to the refresh spinner so it isn't invisible in
 * dark mode.
 */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  edges = ['top'],
  className,
  contentClassName,
  padded = true,
  hideNetworkBanner = false,
  keyboardAvoiding = false,
  scrollProps,
  footer,
}: ScreenProps) {
  const { colors } = useTheme();

  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn(
        padded && 'px-4',
        'pb-8',
        contentClassName
      )}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1', padded && 'px-4', contentClassName)}>{children}</View>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      {hideNetworkBanner ? null : <NetworkBanner />}
      {wrapped}
      {footer ? (
        <View className="border-t border-border bg-surface px-4 pb-6 pt-3">{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}
