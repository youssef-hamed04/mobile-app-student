import { Image } from 'expo-image';
import * as React from 'react';
import { View } from 'react-native';

/**
 * App mark: the Student Center badge.
 *
 * Rendered from the artwork rather than redrawn as SVG — the mark's gear
 * teeth, helmet and lettering are too fine to reproduce by hand without
 * drifting from the real logo, and a drifted logo is worse than a raster one.
 *
 * It is deliberately NOT theme-aware: the badge is a fixed identity, so it
 * keeps its black linework and orange plate in both light and dark mode. That
 * black linework is also why it needs a light ground — see the white
 * `backgroundColor` on the splash and adaptive icon in app.config.ts.
 */
export function BrandMark({ size = 96 }: { size?: number }) {
  return (
    <View accessibilityRole="image" accessibilityLabel="Student Center">
      <Image
        source={require('../../../assets/images/logo.png')}
        style={{ width: size, height: size }}
        contentFit="contain"
        // Bundled locally, so it is decoded once and never refetched.
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
