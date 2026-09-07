import { Redirect, Stack } from 'expo-router';
import * as React from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

export default function AuthLayout() {
  const { status } = useAuth();

  // Prevents the login screen flashing behind a deep link once the session
  // has been restored.
  if (status === 'authenticated') return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
