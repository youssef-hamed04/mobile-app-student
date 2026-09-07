/** Small runtime guards used across features. */

export const isNonEmpty = <T>(a: T[] | null | undefined): a is T[] =>
  Array.isArray(a) && a.length > 0;

export const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep-link / notification routes arrive from the network. Only allow
 * in-app absolute paths so a malicious payload can't push the user to an
 * external URL or a native scheme.
 */
const ALLOWED_ROUTE = /^\/(?:course|lesson|player|viewer|settings|profile|search|notifications)(?:\/[A-Za-z0-9._~-]+)*\/?$/;

export function isSafeInternalRoute(route: string | null | undefined): route is string {
  if (!route) return false;
  if (route.includes('..')) return false;
  return ALLOWED_ROUTE.test(route);
}

export const noop = () => undefined;
