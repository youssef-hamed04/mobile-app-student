import { Image } from 'expo-image';
import * as React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * App mark: the Student Center logo.
 *
 * Rendered from the artwork rather than redrawn as SVG — the cog's teeth and
 * the swoosh inside it are too fine to reproduce by hand without drifting from
 * the real logo, and a drifted logo is worse than a raster one.
 *
 * Two cuts of the same artwork:
 *  - `lockup` (default) is the cog plus the "STUDENT CENTER" wordmark. Use it
 *    where the logo has to introduce the app and nothing else names it.
 *  - `mark` is the cog alone. Use it next to type that already says the name,
 *    so the name isn't printed twice.
 *
 * The artwork is a single ink over transparency, which is what makes the dark
 * mode tint below safe: it recolours one flat colour, so nothing about the
 * shape changes. The mark's own red sits at 3.5:1 on the dark surface — legal
 * for a graphic, but muddy — so dark mode uses the lifted red the rest of the
 * dark palette already uses (5.2:1). Light mode is left untouched at 4.8:1.
 */

/** Intrinsic aspect ratios (height ÷ width) of the two asset files. */
const RATIO = {
  lockup: 531 / 1024,
  mark: 512 / 467,
} as const;

const SOURCE = {
  lockup: require('../../../assets/images/logo.png'),
  mark: require('../../../assets/images/logo-mark.png'),
} as const;

export function BrandMark({
  variant = 'lockup',
  width = 224,
  onPlate = false,
}: {
  variant?: 'lockup' | 'mark';
  width?: number;
  /**
   * The mark is sitting on its own orange plate, so it keeps the exact ink it
   * was drawn with in both themes — the dark-mode lift below exists for dark
   * *surfaces*, and applying it here would recolour the logo against the one
   * ground it was designed for.
   */
  onPlate?: boolean;
}) {
  const { isDark, colors } = useTheme();

  return (
    <View accessibilityRole="image" accessibilityLabel="Student Center">
      <Image
        source={SOURCE[variant]}
        style={{ width, height: width * RATIO[variant] }}
        contentFit="contain"
        tintColor={isDark && !onPlate ? colors.accent : undefined}
        // Bundled locally, so it is decoded once and never refetched.
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
