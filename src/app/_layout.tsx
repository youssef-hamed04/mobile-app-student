import '@/theme/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Cairo_400Regular, Cairo_600SemiBold } from '@expo-google-fonts/cairo';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootstrapQueryManagers, persistOptions, queryClient } from '@/api/query-client';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { PrivacyShield } from '@/components/feedback/PrivacyShield';
import { ToastHost } from '@/components/feedback/ToastHost';
import { env } from '@/config/env';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { initI18n } from '@/i18n';
import { contentProtection } from '@/services/content-protection';
import { createLogger } from '@/services/logger';
import {
  addNotificationResponseListener,
  getInitialNotificationRoute,
  routeFromNotification,
} from '@/services/notifications';
import { ThemeProvider } from '@/theme/ThemeProvider';

const log = createLogger('bootstrap');

// Keep the native splash up until fonts, i18n and the protection layer are
// ready, so the first frame the student sees is already correct — including
// its layout direction.
void SplashScreen.preventAutoHideAsync();
void SplashScreen.setOptions({ duration: 220, fade: true });

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);

  // Latin + Arabic faces are pulled from @expo-google-fonts so no binary
  // font assets need to live in the repo. The keys here are the family names
  // referenced by tailwind.config.js (`font-sans`, `font-heading`,
  // `font-arabic`).
  const [fontsLoaded, fontError] = useFonts({
    Inter: Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    Cairo: Cairo_400Regular,
    'Cairo-SemiBold': Cairo_600SemiBold,
  });

  React.useEffect(() => {
    void (async () => {
      try {
        await initI18n();
        await contentProtection.initialize();
      } catch (e) {
        // Never block startup on a non-fatal init failure; the individual
        // features degrade on their own (untranslated strings, refused
        // protected playback) rather than showing a blank app.
        log.error('bootstrap step failed', { e: String(e) });
      } finally {
        setReady(true);
      }
    })();

    return bootstrapQueryManagers();
  }, []);

  const appReady = ready && (fontsLoaded || !!fontError);

  React.useEffect(() => {
    if (appReady) void SplashScreen.hideAsync();
  }, [appReady]);

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProviders>
          <ThemeProvider>
            <ErrorBoundary>
              <AuthProvider>
                <NotificationRouter />
                <RootNavigator />
                <ToastHost />
                {/* Rendered last so it paints above every navigator layer. */}
                <PrivacyShield />
              </AuthProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </QueryProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Cache persistence is opt-out via EXPO_PUBLIC_ENABLE_QUERY_PERSISTENCE.
 * When it's off we mount the plain provider rather than passing an undefined
 * persister, which the persist provider does not accept.
 */
function QueryProviders({ children }: { children: React.ReactNode }) {
  if (!env.features.queryPersistence) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}

function RootNavigator() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Gestures follow the layout direction automatically because the
        // whole native view tree is mirrored in RTL.
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="course/[courseId]" />
      <Stack.Screen name="lesson/[lessonId]" />
      <Stack.Screen
        name="player/[videoId]"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
          // Swipe-to-dismiss during playback would tear down the secure
          // surface mid-frame; dismissal is an explicit button instead.
        }}
      />
      <Stack.Screen
        name="viewer/[attachmentId]"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="settings" />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

/**
 * Turns notification taps into navigation. Kept as a component (not a plain
 * effect in RootLayout) so it mounts *inside* the router context and can use
 * `useRouter` safely.
 */
function NotificationRouter() {
  const router = useRouter();

  React.useEffect(() => {
    void (async () => {
      const initial = await getInitialNotificationRoute();
      // Defer past the first navigation so we don't race the auth gate.
      if (initial) setTimeout(() => router.push(initial as never), 400);
    })();

    const sub = addNotificationResponseListener((response) => {
      const route = routeFromNotification(response);
      if (route) router.push(route as never);
    });

    return () => sub.remove();
  }, [router]);

  return null;
}
