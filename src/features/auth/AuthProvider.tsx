import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { onSessionEnded } from '@/api/client';
import { ApiError } from '@/api/errors';
import { qk } from '@/api/query-keys';
import { resetQueryCache } from '@/api/query-client';
import {
  clearTokens,
  hydrateTokens,
  setTokens,
} from '@/api/token-store';
import { i18n } from '@/i18n';
import { clearUserScope } from '@/services/kv';
import { createLogger } from '@/services/logger';
import { unregisterPushToken } from '@/services/notifications';
import {
  SecureKeys,
  secureGet,
  secureSet,
} from '@/services/secure-storage';
import { toast } from '@/store/ui-store';
import type { User } from '@/types/domain';
import { safeJson } from '@/utils/guards';

import {
  authApi,
  type LoginPayload,
  type RegisterPayload,
} from './api';

const log = createLogger('auth');

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Set when the session ended involuntarily, so login can explain why. */
  lastSessionError: ApiError | null;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSessionError: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Session owner.
 *
 * Responsibilities kept deliberately narrow: it holds *who is signed in*, and
 * it is the single place that can tear a session down. Everything else about
 * the user (profile edits, devices, preferences) is server state and lives in
 * TanStack Query.
 *
 * Cold-start behaviour: a cached user snapshot is restored from the Keychain
 * so the app can render the authenticated shell immediately, then `/auth/me`
 * revalidates in the background. If revalidation returns 401 the interceptor
 * has already fired `onSessionEnded` and we drop to the login screen.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<User | null>(null);
  const [lastSessionError, setLastSessionError] = React.useState<ApiError | null>(null);

  const persistUser = React.useCallback(async (next: User | null) => {
    setUser(next);
    if (next) {
      await secureSet(SecureKeys.userSnapshot, JSON.stringify(next));
    }
  }, []);

  // ---- teardown ---------------------------------------------------------

  const teardown = React.useCallback(
    async (error?: ApiError) => {
      setStatus('unauthenticated');
      setUser(null);
      setLastSessionError(error ?? null);

      await Promise.allSettled([
        clearTokens(),
        resetQueryCache(),
        unregisterPushToken(),
      ]);
      clearUserScope();
      queryClient.removeQueries();
    },
    [queryClient]
  );

  // The interceptor fires this when a refresh is rejected or the account is
  // disabled — from anywhere in the app, including background refetches.
  React.useEffect(
    () =>
      onSessionEnded((error) => {
        log.warn('session ended by server', { code: error.code });
        void teardown(error);
        toast.error(
          i18n.t(error.i18nKey, { defaultValue: i18n.t('errors.SESSION_EXPIRED') })
        );
      }),
    [teardown]
  );

  // ---- bootstrap --------------------------------------------------------

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const tokens = await hydrateTokens();

      if (!tokens) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }

      // Optimistic restore from the encrypted snapshot.
      const snapshot = safeJson<User | null>(
        await secureGet(SecureKeys.userSnapshot),
        null
      );
      if (snapshot && !cancelled) {
        setUser(snapshot);
        setStatus('authenticated');
      }

      try {
        const fresh = await authApi.me();
        if (cancelled) return;
        await persistUser(fresh);
        setStatus('authenticated');
      } catch (e) {
        if (cancelled) return;
        // A 401 has already triggered onSessionEnded. Any other failure
        // (offline, 5xx) must NOT sign the student out — keep the snapshot.
        if (e instanceof ApiError && e.status === 401) return;
        log.warn('me() failed on bootstrap, keeping cached session', {
          e: String(e),
        });
        if (snapshot) setStatus('authenticated');
        else setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistUser]);

  // ---- actions ----------------------------------------------------------

  const login = React.useCallback(
    async (payload: LoginPayload) => {
      const res = await authApi.login(payload);
      await setTokens(res);
      await persistUser(res.user);
      setLastSessionError(null);
      setStatus('authenticated');
      await queryClient.invalidateQueries();
      return res.user;
    },
    [persistUser, queryClient]
  );

  const register = React.useCallback(
    async (payload: RegisterPayload) => {
      const res = await authApi.register(payload);
      await setTokens(res);
      await persistUser(res.user);
      setLastSessionError(null);
      setStatus('authenticated');
      return res.user;
    },
    [persistUser]
  );

  const logout = React.useCallback(async () => {
    // Tell the server first so the refresh token and the streaming
    // concurrency slot are revoked, but never block local teardown on it.
    await authApi.logout().catch(() => undefined);
    await teardown();
  }, [teardown]);

  const refreshUser = React.useCallback(async () => {
    const fresh = await authApi.me();
    await persistUser(fresh);
    queryClient.setQueryData(qk.auth.me(), fresh);
  }, [persistUser, queryClient]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      lastSessionError,
      login,
      register,
      logout,
      refreshUser,
      clearSessionError: () => setLastSessionError(null),
    }),
    [status, user, lastSessionError, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience for screens that require a signed-in user. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called outside an authenticated route');
  return user;
}
