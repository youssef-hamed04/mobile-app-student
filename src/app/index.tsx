import { Redirect } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Auth gate.
 *
 * The root route resolves to exactly one of three states and never renders
 * real content itself, so there is a single place where "is this student
 * signed in" decides the navigation tree.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 bg-background">
        <Spinner fullscreen />
      </View>
    );
  }

  return status === 'authenticated' ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
