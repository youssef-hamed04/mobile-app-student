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
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { initI18n } from '@/i18n';
import { contentProtection } from '@/services/content-protection';
import { createLogger } from '@/services/logger';
import { kv, KvKeys } from '@/services/kv';
import {
  addNotificationResponseListener,
  getInitialNotificationResponse,
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
  const { status } = useAuth();

  // Everything outside index/(auth)/+not-found requires a session. A deep
  // link or a notification tap that lands on a protected route while signed
  // out is sent back to the index gate (and from there to login) instead of
  // rendering a screen whose every request 401s. `loading` is allowed
  // through so a cold-start deep link is not lost while the session is being
  // restored; the index gate and the request layer settle it.
  const signedInOrRestoring = status !== 'unauthenticated';

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
      <Stack.Protected guard={signedInOrRestoring}>
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
        <Stack.Screen name="library" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="support" />
      </Stack.Protected>
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
    // The same response can be delivered twice — once as the "last response"
    // on a cold start and once through the listener — and the last response
    // survives across launches on some platforms. Route each tap once.
    const handled = new Set<string>();
    const routeOnce = (id: string | undefined, route: string | null) => {
      if (!route) return;
      if (id) {
        if (handled.has(id) || kv.getString(KvKeys.lastHandledNotification) === id) return;
        handled.add(id);
        kv.set(KvKeys.lastHandledNotification, id);
      }
      router.push(route as never);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const initial = await getInitialNotificationResponse();
      if (!initial) return;
      // Defer past the first navigation so we don't race the auth gate.
      timer = setTimeout(
        () => routeOnce(initial.notification.request.identifier, routeFromNotification(initial)),
        400
      );
    })();

    const sub = addNotificationResponseListener((response) => {
      routeOnce(response.notification.request.identifier, routeFromNotification(response));
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [router]);

  return null;
}
