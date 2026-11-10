import { Redirect, Stack } from 'expo-router';
import * as React from 'react';

import { releaseFeatures } from '@/config/release-features';

export default function WalletLayout() {
  // Covers deep links, push taps and every nested route, not just visible links.
  if (!releaseFeatures.wallet) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
