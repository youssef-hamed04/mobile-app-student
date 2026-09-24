import { MMKV } from 'react-native-mmkv';

/**
 * Fast synchronous key-value storage for NON-SENSITIVE local data:
 * theme, language, playback preferences, cached list metadata, onboarding
 * flags, offline watch-progress queue.
 *
 * Anything sensitive (tokens, device secret) belongs in
 * @/services/secure-storage, which is backed by Keychain / Keystore.
 */
export const kv = new MMKV({ id: 'edu-app' });

/** Separate instance so `clearUserScope()` cannot wipe device-level prefs. */
export const userKv = new MMKV({ id: 'edu-user' });

export const KvKeys = {
  theme: 'pref.theme',
  language: 'pref.language',
  playbackRate: 'pref.playbackRate',
  preferredQuality: 'pref.preferredQuality',
  autoQuality: 'pref.autoQuality',
  captionsEnabled: 'pref.captionsEnabled',
  autoplayNext: 'pref.autoplayNext',
  notificationsEnabled: 'pref.notificationsEnabled',
  onboardingSeen: 'flag.onboardingSeen',
  lastRoute: 'nav.lastRoute',
  recentSearches: 'search.recent',
  progressQueue: 'progress.queue',
  pushToken: 'push.token',
  lastHandledNotification: 'push.lastHandledNotification',
} as const;

export type KvKey = (typeof KvKeys)[keyof typeof KvKeys];

export const kvJson = {
  get<T>(key: string, fallback: T): T {
    const raw = userKv.getString(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    userKv.set(key, JSON.stringify(value));
  },
  remove(key: string) {
    userKv.delete(key);
  },
};

/** Called on logout — wipes user-scoped data, keeps device preferences. */
export function clearUserScope() {
  userKv.clearAll();
}
