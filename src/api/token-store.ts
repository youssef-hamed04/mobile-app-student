import {
  SecureKeys,
  secureClearSession,
  secureGet,
  secureSet,
} from '@/services/secure-storage';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires (from the server's expiresIn). */
  accessExpiresAt: number;
}

/**
 * In-memory cache in front of the Keychain so the request interceptor does
 * not await secure storage on every call. The Keychain remains the source of
 * truth across cold starts.
 */
let memory: TokenPair | null = null;
let hydrated = false;

export async function hydrateTokens(): Promise<TokenPair | null> {
  if (hydrated) return memory;

  const [accessToken, refreshToken] = await Promise.all([
    secureGet(SecureKeys.accessToken),
    secureGet(SecureKeys.refreshToken),
  ]);

  hydrated = true;
  if (!accessToken || !refreshToken) {
    memory = null;
    return null;
  }

  memory = { accessToken, refreshToken, accessExpiresAt: readExp(accessToken) };
  return memory;
}

export function getTokensSync(): TokenPair | null {
  return memory;
}

export async function setTokens(pair: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}): Promise<void> {
  const accessExpiresAt = pair.expiresIn
    ? Date.now() + pair.expiresIn * 1000
    : readExp(pair.accessToken);

  memory = { ...pair, accessExpiresAt };
  hydrated = true;

  await Promise.all([
    secureSet(SecureKeys.accessToken, pair.accessToken),
    secureSet(SecureKeys.refreshToken, pair.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  memory = null;
  hydrated = true;
  await secureClearSession();
}

/** True when the access token is expired or within the refresh skew window. */
export function isAccessTokenStale(skewMs = 30_000): boolean {
  if (!memory) return false;
  if (!memory.accessExpiresAt) return false;
  return Date.now() >= memory.accessExpiresAt - skewMs;
}

/**
 * Best-effort JWT `exp` reader. Never trusted for authorization — only used
 * to decide when to proactively refresh and avoid a guaranteed 401 round trip.
 */
function readExp(jwt: string): number {
  try {
    const part = jwt.split('.')[1];
    if (!part) return 0;
    const payload = JSON.parse(decodeBase64Url(part)) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes-safe base64url decoder (does not rely on a global `atob`). */
function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let acc = 0;
  let out = '';

  for (const ch of b64) {
    if (ch === '=') break;
    const idx = B64.indexOf(ch);
    if (idx === -1) continue;
    acc = (acc << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }

  // JWT payloads are UTF-8; decodeURIComponent(escape(...)) is the standard
  // trick to widen the latin1 byte string back into UTF-8 text.
  try {
    return decodeURIComponent(
      out
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
  } catch {
    return out;
  }
}
