/**
 * Owner decision D7: there is no staging backend, so the staging profile uses
 * the production API. That is allowed only when acknowledged, is shown in the
 * app, and never affects production builds. No staging hostname is invented.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ar from '../src/i18n/locales/ar.json';
import en from '../src/i18n/locales/en.json';
import {
  PRODUCTION_API_HOSTS,
  STAGING_ACK_VALUE,
  STAGING_ACK_VARIABLE,
  stagingBuildProblems,
  stagingTargetsProduction,
} from '../src/config/staging-guard';

const PROD_API = 'https://student-backend-814y.onrender.com/api/v1';

type Profile = { extends?: string; env?: Record<string, string> };
const eas = JSON.parse(readFileSync(join(__dirname, '..', 'eas.json'), 'utf8')) as {
  build: Record<string, Profile>;
};

/** A profile's env with `extends` applied, as EAS resolves it. */
function profileEnv(name: string): Record<string, string> {
  const profile = eas.build[name];
  if (!profile) throw new Error(`eas.json has no "${name}" profile`);
  const parent = profile.extends ? profileEnv(profile.extends) : {};
  return { ...parent, ...(profile.env ?? {}) };
}

describe('environment selection per build profile', () => {
  it('staging is a staging build of its own app id, using the production API', () => {
    const env = profileEnv('staging');
    expect(env.APP_VARIANT).toBe('staging');
    expect(env.EXPO_PUBLIC_ENV).toBe('staging');
    expect(env.EXPO_PUBLIC_API_URL).toBe(PROD_API);
    expect(env.EXPO_PUBLIC_USE_MOCKS).toBe('false');
  });

  it('staging carries the explicit acknowledgement that it uses production data', () => {
    expect(profileEnv('staging')[STAGING_ACK_VARIABLE]).toBe(STAGING_ACK_VALUE);
  });

  it('production does not need, and does not carry, the staging acknowledgement', () => {
    for (const name of ['production', 'production:apk']) {
      const env = profileEnv(name);
      expect(env.EXPO_PUBLIC_ENV).toBe('production');
      expect(env.EXPO_PUBLIC_API_URL).toBe(PROD_API);
      expect(env[STAGING_ACK_VARIABLE]).toBeUndefined();
    }
  });

  it('points every release profile at a real host: production, never an invented staging one', () => {
    for (const [name] of Object.entries(eas.build)) {
      const url = profileEnv(name).EXPO_PUBLIC_API_URL;
      if (!url) continue;
      const host = new URL(url).hostname;
      // Development builds use the emulator's view of a laptop.
      expect([...PRODUCTION_API_HOSTS, '10.0.2.2']).toContain(host);
      expect(host).not.toMatch(/staging|stg/i);
    }
  });
});

describe('the staging build guard', () => {
  const staging = (overrides: Record<string, string | undefined> = {}) => ({
    EXPO_PUBLIC_ENV: 'staging',
    EXPO_PUBLIC_API_URL: PROD_API,
    EXPO_PUBLIC_USE_MOCKS: 'false',
    [STAGING_ACK_VARIABLE]: STAGING_ACK_VALUE,
    ...overrides,
  });

  it('passes the real staging profile', () => {
    expect(stagingBuildProblems(profileEnv('staging'))).toEqual([]);
  });

  it('refuses production data without the acknowledgement', () => {
    const problems = stagingBuildProblems(staging({ [STAGING_ACK_VARIABLE]: undefined }));
    expect(problems.join('\n')).toMatch(/PRODUCTION API/);
  });

  it.each([
    ['plain http', 'http://student-backend-814y.onrender.com/api/v1'],
    ['a laptop', 'http://10.0.2.2:3000/api/v1'],
    ['a placeholder', 'https://api.example.com/api/v1'],
    ['nothing', undefined],
  ])('refuses %s as the staging API', (_name, url) => {
    expect(stagingBuildProblems(staging({ EXPO_PUBLIC_API_URL: url }))).not.toEqual([]);
  });

  it('accepts a future real staging API without any acknowledgement', () => {
    // Illustrative only: no such host is configured anywhere.
    expect(
      stagingBuildProblems(staging({ EXPO_PUBLIC_API_URL: 'https://api.staging.invalid/api/v1', [STAGING_ACK_VARIABLE]: undefined })),
    ).toEqual([]);
  });

  it('never applies to production or development builds', () => {
    expect(stagingBuildProblems({ ...profileEnv('production') })).toEqual([]);
    expect(stagingBuildProblems({ ...profileEnv('development') })).toEqual([]);
  });
});

describe('app.config.ts enforces the same rule on the build worker', () => {
  const KEYS = ['EXPO_PUBLIC_ENV', 'APP_VARIANT', 'EAS_BUILD', 'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_USE_MOCKS', STAGING_ACK_VARIABLE];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => KEYS.forEach((k) => (saved[k] = process.env[k])));
  afterEach(() =>
    KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))),
  );

  function load(env: Record<string, string | undefined>) {
    for (const k of KEYS) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    let mod: { default: (ctx: { config: object }) => { name: string } } | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('../app.config');
    });
    return mod!.default({ config: {} });
  }

  it('builds the acknowledged staging profile', () => {
    expect(load({ ...profileEnv('staging'), EAS_BUILD: 'true' }).name).toBe('EduPlatform (Stg)');
  });

  it('refuses a staging build on the worker without the acknowledgement', () => {
    expect(() => load({ ...profileEnv('staging'), EAS_BUILD: 'true', [STAGING_ACK_VARIABLE]: undefined })).toThrow(
      /Staging build refused[\s\S]*PRODUCTION API/,
    );
  });

  it('does not block local tooling that only reads the config', () => {
    expect(() => load({ ...profileEnv('staging'), EAS_BUILD: undefined, [STAGING_ACK_VARIABLE]: undefined })).not.toThrow();
  });
});

describe('the running staging app says it is on production data', () => {
  it('flags only a staging build that targets the production API', () => {
    expect(stagingTargetsProduction('staging', PROD_API)).toBe(true);
    expect(stagingTargetsProduction('production', PROD_API)).toBe(false);
    expect(stagingTargetsProduction('development', 'http://10.0.2.2:3000/api/v1')).toBe(false);
    expect(stagingTargetsProduction('staging', 'https://api.staging.invalid/api/v1')).toBe(false);
  });

  it('has the badge text in both languages', () => {
    expect(en.staging.productionApiBadge).toMatch(/PRODUCTION/);
    expect(ar.staging.productionApiBadge).toBeTruthy();
  });
});
