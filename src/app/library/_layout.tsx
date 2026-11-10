import { Redirect, Stack } from 'expo-router';
import * as React from 'react';

import { releaseFeatures } from '@/config/release-features';

export default function LibraryLayout() {
  // Covers deep links, push taps, the reader and every nested route.
  if (!releaseFeatures.library) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
