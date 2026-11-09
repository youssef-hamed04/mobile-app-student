/**
 * Owner decision D7: there is no staging backend. The `staging` build profile
 * points at the PRODUCTION API, so a staging build reads and writes real
 * students' data.
 *
 * Until a real staging API exists this is allowed, but never silently:
 *  - an EAS staging build is refused unless its profile carries the explicit
 *    acknowledgement (`STAGING_USES_PRODUCTION_API=acknowledged`, eas.json);
 *  - the running staging app shows a permanent "production data" badge.
 *
 * Production builds are not affected by anything here.
 *
 * The production host is listed, not guessed: it is the API every store build
 * uses (eas.json `production`). No staging hostname is invented - when a real
 * staging API exists, point the staging profile at it and this guard goes
 * quiet on its own.
 */

/** API hosts that serve real students. */
export const PRODUCTION_API_HOSTS: readonly string[] = ['student-backend-814y.onrender.com'];

export const STAGING_ACK_VARIABLE = 'STAGING_USES_PRODUCTION_API';
export const STAGING_ACK_VALUE = 'acknowledged';

export function apiHost(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isProductionApi(apiUrl: string | undefined): boolean {
  const host = apiHost(apiUrl);
  return host !== null && PRODUCTION_API_HOSTS.includes(host);
}

/** True for a staging build that talks to the production API. */
export function stagingTargetsProduction(envName: string | undefined, apiUrl: string | undefined): boolean {
  return envName === 'staging' && isProductionApi(apiUrl);
}

/**
 * Problems that must stop a staging build. Empty for every non-staging build.
 */
export function stagingBuildProblems(env: Record<string, string | undefined>): string[] {
  if (env.EXPO_PUBLIC_ENV !== 'staging') return [];
  const problems: string[] = [];
  const apiUrl = env.EXPO_PUBLIC_API_URL;
  const host = apiHost(apiUrl);

  if (!host) {
    problems.push('EXPO_PUBLIC_API_URL is missing or not a valid URL');
    return problems;
  }
  if (!/^https:/i.test(apiUrl ?? '')) problems.push('EXPO_PUBLIC_API_URL must use https://');
  if (
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/.test(host) ||
    /(^|\.)example\.(com|org|net)$/.test(host)
  ) {
    problems.push(`EXPO_PUBLIC_API_URL points at a local or placeholder host (${host})`);
  }
  if (env.EXPO_PUBLIC_USE_MOCKS === 'true') {
    problems.push('EXPO_PUBLIC_USE_MOCKS must not be true in a staging build');
  }
  if (isProductionApi(apiUrl) && env[STAGING_ACK_VARIABLE] !== STAGING_ACK_VALUE) {
    problems.push(
      `this staging build would use the PRODUCTION API (${host}) and real student data. ` +
        `Set ${STAGING_ACK_VARIABLE}=${STAGING_ACK_VALUE} in the staging profile to accept that ` +
        '(no staging backend exists yet - see OWNER_DECISIONS D7).',
    );
  }
  return problems;
}
