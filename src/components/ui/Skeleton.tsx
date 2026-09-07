import * as React from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/utils/cn';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  style?: ViewStyle;
}

const RADIUS = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' };

/**
 * Shimmering placeholder.
 *
 * Uses a pulsing opacity rather than a moving gradient: it costs one animated
 * value per node instead of a masked gradient layer, which matters on the
 * course list where a dozen skeletons mount at once on low-end devices.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = 'sm',
  className,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.45);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('bg-surface-alt', RADIUS[rounded], className)}
      style={[{ width, height }, style, animated]}
    />
  );
}

/** Common composite: a media card placeholder. */
export function CardSkeleton() {
  return (
    <View className="mb-4 overflow-hidden rounded-lg border border-border bg-surface">
      <Skeleton height={148} rounded="sm" />
      <View className="gap-2 p-4">
        <Skeleton height={18} width="75%" />
        <Skeleton height={14} width="45%" />
        <Skeleton height={10} width="100%" rounded="full" />
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton width={56} height={56} rounded="md" />
          <View className="flex-1 gap-2">
            <Skeleton height={15} width="70%" />
            <Skeleton height={12} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}
