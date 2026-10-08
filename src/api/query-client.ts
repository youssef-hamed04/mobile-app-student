import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { env } from '@/config/env';

import { ApiError, isApiError } from './errors';

/**
 * Never retry an error the backend already decided on (403 device, 402
 * payment, 404). Retrying those just burns battery and confuses students.
 */
function retryPolicy(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return failureCount < 1;
  if (!error.retryable) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: retryPolicy,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: (count, error) =>
        isApiError(error) && error.code === 'NETWORK_TIMEOUT' && count < 1,
      networkMode: 'online',
    },
  },
});

/**
 * Cache persistence lets the app open to real content instead of skeletons
 * on a cold start with a slow network.
 *
 * SECURITY: playback tickets, attachment tickets and anything else carrying
 * a signed URL are excluded — they must never survive process death.
 */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rq-cache-v1',
  throttleTime: 2000,
});

// Kept in memory only. AsyncStorage is not encrypted, so anything listed here
// must be a record the student would not want readable off a lost or shared
// device: credentials, signed URLs, entitlements and personal history.
//
// Matched as key PREFIXES, not just the root. Several personal records are
// nested under a public root -- `courses` also serves the catalog -- so a
// root-only check silently persisted them. Each entry is compared segment by
// segment against the front of the query key.
const NEVER_PERSIST_PREFIXES: readonly (readonly string[])[] = [
  // Credentials and signed URLs.
  ['auth'],
  ['playback'],
  ['attachments'],
  ['library', 'document'],
  // Balances, entitlements, purchases and play allowance.
  ['wallet'],
  ['courses', 'play-allowance'],
  ['library', 'mine'],
  ['library', 'purchases'],
  ['courses', 'my-parts'],
  // Personal records: correspondence, history and device inventory.
  ['support'],
  ['notifications'],
  ['progress'],
  ['devices'],
  ['courses', 'mine'],
  ['courses', 'progress'],
];

function isNeverPersisted(queryKey: readonly unknown[]): boolean {
  return NEVER_PERSIST_PREFIXES.some((prefix) =>
    prefix.every((segment, index) => queryKey[index] === segment),
  );
}

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  buster: `${env.appVersion}-${env.env}`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[] }) => {
      const root = query.queryKey[0];
      if (typeof root !== 'string') return false;
      return !isNeverPersisted(query.queryKey);
    },
  },
};

/** Wire React Native app-state + connectivity into TanStack Query. */
export function bootstrapQueryManagers() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    })
  );

  const onChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}

/** Called on logout — wipes every cached response for the previous student. */
export async function resetQueryCache() {
  queryClient.clear();
  await persister.removeClient();
}

export type { ApiError };
