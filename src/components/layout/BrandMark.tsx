import * as React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { brand } from '@/theme/palette';

/**
 * App mark: an orange→red gradient tile with a stylised open book.
 *
 * Drawn as SVG rather than a PNG so it stays crisp at every size and keeps
 * the brand gradient identical in light and dark mode (the mark is one of the
 * few elements that must NOT adapt to the theme).
 */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <View accessibilityRole="image" accessibilityLabel="EduPlatform">
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={brand.orange} />
            <Stop offset="1" stopColor={brand.red} />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="64" height="64" rx="16" fill="url(#brandGrad)" />

        <Path
          d="M15 20.5c5.4-2.6 10.6-2.6 16 0v25c-5.4-2.6-10.6-2.6-16 0v-25Z"
          fill={brand.white}
          opacity={0.95}
        />
        <Path
          d="M33 20.5c5.4-2.6 10.6-2.6 16 0v25c-5.4-2.6-10.6-2.6-16 0v-25Z"
          fill={brand.white}
          opacity={0.72}
        />
        <Path
          d="M32 21.5v24"
          stroke={brand.black}
          strokeOpacity={0.18}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
