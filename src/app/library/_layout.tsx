import { Stack } from 'expo-router';
import * as React from 'react';

export default function LibraryLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
