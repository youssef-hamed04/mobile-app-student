import NetInfo from '@react-native-community/netinfo';
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env, useMocks } from '@/config/env';
import { deviceHeaders } from '@/services/device';
import { createLogger } from '@/services/logger';
import type { ApiEnvelope, RequestOptions } from '@/types/api';

import {
  ApiError,
  SESSION_ENDING,
  asApiError,
  networkError,
  toApiError,
} from './errors';
import { mockRequest } from './mock';
import {
  clearTokens,
  getTokensSync,
  hydrateTokens,
  isAccessTokenStale,
  setTokens,
} from './token-store';

const log = createLogger('api');

// ---------------------------------------------------------------------------
// Session-death broadcast
// ---------------------------------------------------------------------------

type SessionListener = (error: ApiError) => void;
const sessionListeners = new Set<SessionListener>();

/**
 * Registered by the auth provider. Fires when the backend has definitively
 * ended the session (refresh rejected, account disabled, device revoked) so
 * the app can tear down state and route to login exactly once.
 */
export function onSessionEnded(fn: SessionListener) {
  sessionListeners.add(fn);
  return () => {
    sessionListeners.delete(fn);
  };
}

function broadcastSessionEnded(error: ApiError) {
  for (const fn of sessionListeners) {
    try {
      fn(error);
    } catch (e) {
      log.error('session listener threw', { e: String(e) });
    }
  }
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _didRefresh?: boolean;
  _opts?: RequestOptions;
}

export const http: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  // Never send cookies; auth is bearer-token only.
  withCredentials: false,
});

http.interceptors.request.use(async (config) => {
  const cfg = config as RetryableConfig;
  const opts = cfg._opts ?? {};

  if (!opts.anonymous) {
    // Proactive refresh: avoids a guaranteed 401 when we already know the
    // access token is past (or nearly past) its exp.
    if (isAccessTokenStale() && !cfg._didRefresh && !opts.skipRefresh) {
      await refreshTokens().catch(() => undefined);
    }
    const tokens = getTokensSync();
    if (tokens) {
      cfg.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }
  }

  const dh = await deviceHeaders();
  for (const [k, v] of Object.entries(dh)) cfg.headers.set(k, v);

  cfg.headers.set('Accept-Language', currentLanguageHeader());
  cfg.headers.set('X-Client', 'mobile');
  cfg.headers.set('X-Request-Id', requestId());

  return cfg;
});

// ---------------------------------------------------------------------------
// Token refresh — single-flight with a waiter queue
// ---------------------------------------------------------------------------

let refreshPromise: Promise<void> | null = null;

async function refreshTokens(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const tokens = getTokensSync() ?? (await hydrateTokens());
    if (!tokens?.refreshToken) {
      throw new ApiError({
        code: 'SESSION_EXPIRED',
        status: 401,
        message: 'No refresh token available',
      });
    }

    try {
      const dh = await deviceHeaders();
      const res = await axios.post<
        ApiEnvelope<{ accessToken: string; refreshToken: string; expiresIn: number }>
      >(
        '/auth/refresh',
        { refreshToken: tokens.refreshToken },
        { baseURL: env.apiUrl, timeout: env.apiTimeout, headers: dh }
      );

      await setTokens(res.data.data);
      log.info('token refreshed');
    } catch (e) {
      // Only a definitive answer from the auth server ends the session. A
      // transport failure (offline, DNS, timeout) or a transient server error
      // says nothing about the refresh token: treating it as "session
      // expired" signed students out every time they opened the app offline
      // with a stale access token.
      if (!(e instanceof AxiosError) || !e.response) {
        const state = await NetInfo.fetch().catch(() => null);
        const offline =
          state?.isConnected === false || state?.isInternetReachable === false;
        const timedOut =
          e instanceof AxiosError && (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT');
        throw networkError(offline ? 'offline' : timedOut ? 'timeout' : 'unreachable');
      }

      const err = toApiError(e.response.status, e.response.data);
      const definitive =
        e.response.status === 400 ||
        e.response.status === 401 ||
        e.response.status === 403 ||
        SESSION_ENDING.has(err.code);
      if (!definitive) throw err;

      await clearTokens();
      broadcastSessionEnded(
        SESSION_ENDING.has(err.code)
          ? err
          : new ApiError({
              code: 'SESSION_EXPIRED',
              status: 401,
              message: err.message,
            })
      );
      throw err;
    }
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ---------------------------------------------------------------------------
// Response interceptor: normalization, refresh-on-401, retry with backoff
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const MAX_RETRY_AFTER_MS = 10_000;
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const IDEMPOTENT = new Set(['get', 'head', 'options']);

http.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) throw asApiError(error);

    const cfg = error.config as RetryableConfig | undefined;
    const opts = cfg?._opts ?? {};

    // ---- transport failures -------------------------------------------
    if (!error.response) {
      // A caller-initiated cancel (unmount, query cancellation) is not a
      // network fault and must not be retried or reported as one.
      if (axios.isCancel(error) || error.code === 'ERR_CANCELED') throw error;

      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      const state = await NetInfo.fetch().catch(() => null);
      const offline =
        state?.isConnected === false || state?.isInternetReachable === false;

      const apiErr = networkError(offline ? 'offline' : timedOut ? 'timeout' : 'unreachable');

      if (cfg && shouldRetry(cfg, opts) && !offline) {
        return retry(cfg, opts);
      }
      throw apiErr;
    }

    const status = error.response.status;
    const apiErr = toApiError(status, error.response.data);

    // ---- 401: try exactly one silent refresh, then replay --------------
    if (status === 401 && cfg && !opts.anonymous && !opts.skipRefresh && !cfg._didRefresh) {
      cfg._didRefresh = true;
      try {
        await refreshTokens();
      } catch (refreshError) {
        // The refresh failed without ending the session (offline, timeout,
        // 5xx, 429 — tokens are still held): report that problem, not an
        // expired session.
        if (refreshError instanceof ApiError && getTokensSync()) throw refreshError;
        throw new ApiError({
          code: 'SESSION_EXPIRED',
          status: 401,
          message: 'Session expired',
        });
      }
      // Replayed outside the try: an error from the retried request itself
      // (403, 404, 5xx…) is that request's real answer and must not be
      // relabelled as an expired session.
      return http.request(cfg);
    }

    if (SESSION_ENDING.has(apiErr.code)) {
      await clearTokens();
      broadcastSessionEnded(apiErr);
      throw apiErr;
    }

    // ---- transient server errors --------------------------------------
    if (cfg && RETRY_STATUS.has(status) && shouldRetry(cfg, opts)) {
      // Honour Retry-After, but never park a request (and the spinner in
      // front of it) for longer than the backoff ceiling; past that the
      // error is shown and the student can retry.
      const retryAfter = Number(error.response.headers?.['retry-after']);
      if (Number.isFinite(retryAfter) && retryAfter * 1000 > MAX_RETRY_AFTER_MS) {
        throw apiErr;
      }
      return retry(cfg, opts, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined);
    }

    throw apiErr;
  }
);

function shouldRetry(cfg: RetryableConfig, opts: RequestOptions): boolean {
  const max = opts.retries ?? MAX_RETRIES;
  const count = cfg._retryCount ?? 0;
  const method = (cfg.method ?? 'get').toLowerCase();
  // Only retry methods that are safe to repeat. POST/PUT/PATCH/DELETE are
  // retried only when the caller opts in explicitly via `retries`.
  const safe = IDEMPOTENT.has(method) || opts.retries !== undefined;
  return safe && count < max;
}

async function retry(cfg: RetryableConfig, opts: RequestOptions, delayMs?: number) {
  cfg._retryCount = (cfg._retryCount ?? 0) + 1;
  const base = delayMs ?? Math.min(400 * 2 ** (cfg._retryCount - 1), 4000);
  const jitter = Math.random() * 250;
  log.debug('retrying request', { url: cfg.url, attempt: cfg._retryCount });
  await sleep(base + jitter);
  return http.request(cfg);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Public request helper
// ---------------------------------------------------------------------------

let languageHeader = 'en';
export function setApiLanguage(lang: string) {
  languageHeader = lang;
}
function currentLanguageHeader() {
  return languageHeader;
}

let reqCounter = 0;
function requestId() {
  reqCounter += 1;
  return `${Date.now().toString(36)}-${reqCounter.toString(36)}`;
}

/**
 * The single entry point every feature service uses.
 *
 * Responsibilities:
 *  - routes to the mock backend when EXPO_PUBLIC_USE_MOCKS is on (non-prod only)
 *  - unwraps the `{ data }` envelope
 *  - guarantees the thrown value is always an ApiError
 */
export async function request<T>(
  config: AxiosRequestConfig & { url: string },
  options: RequestOptions = {}
): Promise<T> {
  if (useMocks) {
    return mockRequest<T>(config, options);
  }

  try {
    const res = await http.request<ApiEnvelope<T>>({
      ...config,
      timeout: options.timeoutMs ?? env.apiTimeout,
      signal: options.signal,
      headers: { ...(config.headers ?? {}), ...(options.headers ?? {}) },
      // carry per-call options through the interceptors
      ...({ _opts: options } as object),
    });

    // Tolerate both `{ data: T }` and bare `T` responses.
    const body = res.data as ApiEnvelope<T> | T;
    return body && typeof body === 'object' && 'data' in (body as object)
      ? (body as ApiEnvelope<T>).data
      : (body as T);
  } catch (e) {
    throw asApiError(e);
  }
}

export const api = {
  get: <T>(url: string, params?: object, options?: RequestOptions) =>
    request<T>({ method: 'get', url, params }, options),
  post: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    request<T>({ method: 'post', url, data }, options),
  put: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    request<T>({ method: 'put', url, data }, options),
  patch: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    request<T>({ method: 'patch', url, data }, options),
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>({ method: 'delete', url }, options),
};

export { refreshTokens };
