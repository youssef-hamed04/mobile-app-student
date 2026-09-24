import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { brand } from '@/theme/palette';
import { isSafeInternalRoute } from '@/utils/guards';

import { kv, KvKeys } from './kv';
import { createLogger } from './logger';

const log = createLogger('notifications');

/**
 * Push notification architecture.
 *
 * The mobile side owns four things:
 *   1. permission acquisition (deferred until the student has a reason to say
 *      yes — see `requestPermissionWithContext`)
 *   2. token registration with the backend, keyed by device id so the backend
 *      can fan out per-device and revoke on unbind
 *   3. foreground presentation rules
 *   4. deep-link routing, with the route validated against an allow-list
 *      before it can drive navigation.
 *
 * The backend owns *what* is sent. Nothing here assumes a provider beyond
 * Expo's push service; swapping to raw FCM/APNs only changes `getPushToken`.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PermissionOutcome = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermissionStatus(): Promise<PermissionOutcome> {
  if (!Device.isDevice) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * Ask for permission. Call this *after* showing the in-app rationale card —
 * the OS prompt can only be shown once, so burning it on app launch loses the
 * majority of opt-ins.
 */
export async function requestPermission(): Promise<PermissionOutcome> {
  if (!Device.isDevice) return 'unsupported';

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return 'granted';
  if (!existing.canAskAgain) return 'denied';

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: false,
    },
  });

  return status === 'granted' ? 'granted' : 'denied';
}

export async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: brand.orange,
    vibrationPattern: [0, 250, 250, 250],
  });

  await Notifications.setNotificationChannelAsync('content', {
    name: 'New lessons and courses',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: brand.orange,
  });

  await Notifications.setNotificationChannelAsync('account', {
    name: 'Account, payments and security',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: brand.red,
  });
}

async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;

  if (!projectId) {
    log.warn('no EAS projectId — push token cannot be issued');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    log.error('failed to obtain push token', { e: String(e) });
    return null;
  }
}

/** Registers the device with the backend. Safe to call repeatedly. */
export async function registerPushToken(): Promise<string | null> {
  const status = await getPermissionStatus();
  if (status !== 'granted') return null;

  await configureAndroidChannels();

  const token = await getPushToken();
  if (!token) return null;

  const previous = kv.getString(KvKeys.pushToken);
  if (previous === token) return token;

  try {
    await api.post(Endpoints.notifications.registerPushToken, {
      token,
      platform: Platform.OS,
      provider: 'expo',
    });
    kv.set(KvKeys.pushToken, token);
    log.info('push token registered');
    return token;
  } catch (e) {
    log.warn('push token registration failed', { e: String(e) });
    return null;
  }
}

/** Called on logout so the next account on this device doesn't inherit pushes. */
export async function unregisterPushToken(): Promise<void> {
  const token = kv.getString(KvKeys.pushToken);
  if (!token) return;

  try {
    // skipRefresh: this runs during sign-out. A 401 here means the session
    // is already gone, and trying to refresh it would re-trigger the
    // session-ended teardown that is currently running.
    await api.delete(Endpoints.notifications.unregisterPushToken(token), {
      retries: 0,
      timeoutMs: 5000,
      skipRefresh: true,
    });
  } catch {
    /* best effort */
  } finally {
    kv.delete(KvKeys.pushToken);
    await Notifications.setBadgeCountAsync(0).catch(() => undefined);
  }
}

export interface PushPayload {
  route?: string;
  notificationId?: string;
  kind?: string;
}

/**
 * Extracts a navigation target from a notification, rejecting anything that
 * isn't a known in-app path. A push payload is attacker-influenceable in the
 * general case; never hand it straight to router.push.
 */
export function routeFromNotification(
  response: Notifications.NotificationResponse
): string | null {
  const data = response.notification.request.content.data as PushPayload | undefined;
  const route = data?.route;
  return isSafeInternalRoute(route) ? route : null;
}

export function addNotificationReceivedListener(
  fn: (n: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(fn);
}

export function addNotificationResponseListener(
  fn: (r: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(fn);
}

export async function getInitialNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}

export async function getInitialNotificationRoute(): Promise<string | null> {
  const response = await getInitialNotificationResponse();
  return response ? routeFromNotification(response) : null;
}

export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => undefined);
}
