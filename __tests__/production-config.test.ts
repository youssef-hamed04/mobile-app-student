/**
 * The production config guard in app.config.ts and the store-facing identity.
 *
 * The guard runs when the config module is evaluated, so every case loads a
 * fresh copy of the module under a controlled environment.
 */

import ar from '../src/i18n/locales/ar.json';
import en from '../src/i18n/locales/en.json';

const GOOD: Record<string, string> = {
  EXPO_PUBLIC_ENV: 'production',
  APP_VARIANT: 'production',
  EAS_BUILD: 'true',
  EXPO_PUBLIC_API_URL: 'https://student-backend-814y.onrender.com/api/v1',
  EXPO_PUBLIC_USE_MOCKS: 'false',
  EXPO_PUBLIC_SUPPORT_PHONE: '+201101112344',
  EXPO_PUBLIC_SUPPORT_WHATSAPP: '+201101112344',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@studentcenter.test',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://student-dashoard.vercel.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://student-dashoard.vercel.app/terms',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://student-dashoard.vercel.app/account-deletion',
};

const KEYS = Object.keys(GOOD);
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function loadConfig(overrides: Record<string, string | undefined> = {}) {
  const env = { ...GOOD, ...overrides };
  for (const k of KEYS) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  type LoadedConfig = {
    name: string;
    android: { package: string; googleServicesFile: string };
    ios: { bundleIdentifier: string };
  };
  let mod: { default: (ctx: { config: object }) => LoadedConfig } | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../app.config');
  });
  return mod!.default({ config: {} });
}

describe('production identity', () => {
  it('is Student Center / com.eduplatform.app on both platforms', () => {
    const config = loadConfig();
    expect(config.name).toBe('Student Center');
    expect(config.android.package).toBe('com.eduplatform.app');
    expect(config.ios.bundleIdentifier).toBe('com.eduplatform.app');
  });

  it('reads the Firebase file from the GOOGLE_SERVICES_JSON file variable when present', () => {
    const prev = process.env.GOOGLE_SERVICES_JSON;
    process.env.GOOGLE_SERVICES_JSON = '/eas/tmp/google-services.json';
    try {
      expect(loadConfig().android.googleServicesFile).toBe('/eas/tmp/google-services.json');
    } finally {
      if (prev === undefined) delete process.env.GOOGLE_SERVICES_JSON;
      else process.env.GOOGLE_SERVICES_JSON = prev;
    }
  });

  it('names the app Student Center inside the app in both languages', () => {
    expect(en.common.appName).toBe('Student Center');
    expect(ar.common.appName).toBe('Student Center');
  });
});

describe('production build guard', () => {
  it('accepts a complete production environment', () => {
    expect(() => loadConfig()).not.toThrow();
  });

  it('refuses mocks', () => {
    expect(() => loadConfig({ EXPO_PUBLIC_USE_MOCKS: 'true' })).toThrow(/USE_MOCKS/);
  });

  it.each([
    'http://student-backend-814y.onrender.com/api/v1',
    'http://10.0.2.2:3000/api/v1',
    'https://api.example.com/api/v1',
  ])('refuses the API URL %s', (url) => {
    expect(() => loadConfig({ EXPO_PUBLIC_API_URL: url })).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it.each([
    'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    'EXPO_PUBLIC_TERMS_URL',
    'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
  ])('refuses a store build without %s', (key) => {
    expect(() => loadConfig({ [key]: undefined })).toThrow(new RegExp(`${key} is not set`));
  });

  it('refuses a non-https legal URL', () => {
    expect(() =>
      loadConfig({ EXPO_PUBLIC_PRIVACY_POLICY_URL: 'http://student-dashoard.vercel.app/privacy' })
    ).toThrow(/EXPO_PUBLIC_PRIVACY_POLICY_URL must use https/);
  });

  it('does not block the local config read that `eas build` does before uploading', () => {
    // Secret EAS variables are not available locally, and dotenv is off.
    expect(() =>
      loadConfig({
        EAS_BUILD: undefined,
        EXPO_PUBLIC_SUPPORT_PHONE: undefined,
        EXPO_PUBLIC_SUPPORT_WHATSAPP: undefined,
        EXPO_PUBLIC_SUPPORT_EMAIL: undefined,
      })
    ).not.toThrow();
  });

  it('does not apply to non-production variants', () => {
    expect(() =>
      loadConfig({ EXPO_PUBLIC_ENV: 'staging', APP_VARIANT: 'staging', EXPO_PUBLIC_TERMS_URL: undefined })
    ).not.toThrow();
  });
});
