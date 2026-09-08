import type { AdTarget } from '@/types/domain';

export type ResolvedAdTarget =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; url: string };

/**
 * Turns a server-described ad destination into something safe to navigate to.
 *
 * Promotions are admin-authored content, so their destinations are treated as
 * untrusted input rather than as a trusted route:
 *
 *  - External links must be http(s). Without this check a banner could carry
 *    a custom-scheme or `javascript:` URL and use the app as the thing that
 *    opens it.
 *  - Internal paths must be a single-slash absolute path. `//evil.com` is a
 *    protocol-relative URL that expo-router would otherwise treat as external,
 *    which is the same escape in a different costume.
 *
 * Anything that fails resolution returns null and the banner renders inert —
 * a promotion that cannot be trusted must not be tappable.
 */
export function resolveAdTarget(target: AdTarget): ResolvedAdTarget | null {
  switch (target.type) {
    case 'NONE':
      return null;

    case 'COURSE':
      return target.entityId
        ? { kind: 'internal', href: `/course/${target.entityId}` }
        : null;

    case 'LESSON':
      return target.entityId
        ? { kind: 'internal', href: `/lesson/${target.entityId}` }
        : null;

    /**
     * A section is not addressable on its own — it is rendered inside the
     * course detail screen. Rather than inventing a route the backend does
     * not serve, SECTION relies on the server supplying the in-app path it
     * wants opened, exactly like APP_SCREEN.
     */
    case 'SECTION':
    case 'APP_SCREEN':
      return isSafeInternalPath(target.url)
        ? { kind: 'internal', href: target.url! }
        : null;

    case 'EXTERNAL_URL':
      return isSafeExternalUrl(target.url)
        ? { kind: 'external', url: target.url! }
        : null;

    default:
      // An unknown target type from a newer backend renders inert rather than
      // guessing — forward compatibility without a blind navigation.
      return null;
  }
}

function isSafeInternalPath(url: string | null): boolean {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

function isSafeExternalUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
