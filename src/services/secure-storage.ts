import * as SecureStore from 'expo-secure-store';

import { createLogger } from './logger';

const log = createLogger('secure-storage');

/**
 * Hardware-backed storage (iOS Keychain / Android Keystore + EncryptedSharedPrefs).
 *
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY means the value is:
 *  - unreadable while the device is locked, and
 *  - excluded from iCloud/iTunes backups and device-to-device transfer,
 * which is exactly what we want for tokens and the device-binding secret:
 * restoring a backup onto a new phone must NOT carry the authorized device
 * identity with it.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const SecureKeys = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  sessionId: 'auth.sessionId',
  userSnapshot: 'auth.userSnapshot',
  deviceSecret: 'device.secret',
  deviceId: 'device.id',
} as const;

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys];

import { Platform } from 'react-native';

export async function secureGet(key: SecureKey): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch (e) {
    log.error('read failed', { key, e: String(e) });
    return null;
  }
}

export async function secureSet(key: SecureKey, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch (e) {
      log.error('web write failed', { key, e: String(e) });
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value, OPTIONS);
  } catch (e) {
    log.error('write failed', { key, e: String(e) });
    throw e;
  }
}

export async function secureDelete(key: SecureKey): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch (e) {
      log.warn('web delete failed', { key, e: String(e) });
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch (e) {
    log.warn('delete failed', { key, e: String(e) });
  }
}

/** Wipes auth material only. The device identity survives logout on purpose. */
export async function secureClearSession(): Promise<void> {
  await Promise.all([
    secureDelete(SecureKeys.accessToken),
    secureDelete(SecureKeys.refreshToken),
    secureDelete(SecureKeys.sessionId),
    secureDelete(SecureKeys.userSnapshot),
  ]);
}
