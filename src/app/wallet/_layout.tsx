import { Stack } from 'expo-router';
import * as React from 'react';

export default function WalletLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
