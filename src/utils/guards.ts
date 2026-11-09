/** Small runtime guards used across features. */

import { isRouteEnabled } from '@/config/release-features';

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
const ALLOWED_ROUTE =
  /^\/(?:course|lesson|player|viewer|settings|profile|search|notifications|library|wallet|support)(?:\/[A-Za-z0-9._~-]+)*\/?$/;

/**
 * The one query-carrying route the backend emits: a teacher search result
 * opens the catalogue filtered by that teacher. Exact shape only — no other
 * parameter, no path segments.
 */
const TEACHER_CATALOGUE_ROUTE = /^\/courses\?teacherId=[A-Za-z0-9_-]+$/;

export function isSafeInternalRoute(route: string | null | undefined): route is string {
  if (!route) return false;
  if (route.includes('..')) return false;
  // Network-supplied routes (push, notifications, search) must not reach a
  // feature this release has turned off.
  if (!isRouteEnabled(route)) return false;
  return ALLOWED_ROUTE.test(route) || TEACHER_CATALOGUE_ROUTE.test(route);
}

export const noop = () => undefined;
