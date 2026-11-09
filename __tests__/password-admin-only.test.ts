import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { Endpoints } from '@/api/endpoints';
import { passwordSchema } from '@/features/auth/schemas';
import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import type * as SupportModule from '@/services/support';

/**
 * Student passwords are administered, never self-service.
 *
 * A student cannot change or recover their own password: they contact the
 * administration, who verify them and set a new one from the dashboard. The
 * backend refuses `POST /auth/password` for a student, but the app must not
 * offer — or quietly call — a self-service path either. These checks keep a
 * change-password form, a reset flow or a stray call from coming back
 * unnoticed. The mock API (`src/api/mock`) is development-only and excluded.
 */

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return full.includes(join('src', 'api', 'mock')) ? [] : walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });

const sources = walk(SRC).map((file) => ({ file, text: readFileSync(file, 'utf8') }));

describe('no student self-service password change or recovery', () => {
  it('declares no password route', () => {
    const paths = JSON.stringify(Endpoints);
    expect(paths).not.toMatch(/password/i);
  });

  it('never calls a password-change or reset endpoint', () => {
    const offenders = sources
      .filter(({ text }) =>
        /['"`]\/(auth|profile)\/password|forgot-password|reset-password|\/otp\b/.test(text),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('has no change-password schema, form or API client', () => {
    const offenders = sources
      .filter(({ text }) => /changePassword|currentPassword/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('carries no strings that promise an in-app password change', () => {
    for (const bundle of [en, ar]) {
      const profile = bundle.profile as Record<string, unknown>;
      expect(profile.changePassword).toBeUndefined();
      expect(profile.currentPassword).toBeUndefined();
      expect(profile.newPassword).toBeUndefined();
      expect(profile.passwordChanged).toBeUndefined();
    }
    expect(en.profile.passwordHelp).toBe('Password help');
    expect(ar.profile.passwordHelp).toBeTruthy();
  });
});

describe('password help goes to the administration', () => {
  it('the sign-in screen still links to password help', () => {
    const login = read('app', '(auth)', 'login.tsx');
    expect(login).toContain('href="/(auth)/password-help"');
    expect(login).toContain("t('auth.forgotPassword')");
  });

  it('the password-help screen offers WhatsApp, a call and e-mail', () => {
    const screen = read('app', '(auth)', 'password-help.tsx');
    expect(screen).toContain("support.whatsapp({ reason: 'password' })");
    expect(screen).toContain('support.call()');
    expect(screen).toContain("support.email({ reason: 'password' })");
    // A channel the device cannot open is reported, not silently ignored.
    expect(screen).toContain("t('auth.supportOpenFailed')");
  });

  it('the profile item is password help, routed to support with the account prefilled', () => {
    const profile = read('app', '(tabs)', 'profile.tsx');
    expect(profile).toContain("t('profile.passwordHelp')");
    expect(profile).toContain("reason: 'password' as const, fullName: user.fullName, phone: user.phone");
    expect(profile).toContain('support.whatsapp(context)');
    expect(profile).toContain('support.email(context)');
  });

  it('explains in both languages that the administration resets passwords', () => {
    expect(en.auth.passwordHelpBody).toMatch(/administration/);
    expect(en.auth.passwordHelpBody).not.toMatch(/OTP|code|link/i);
    expect(ar.auth.passwordHelpBody).toBeTruthy();
    expect(en.auth.supportOpenFailed).toBeTruthy();
    expect(ar.auth.supportOpenFailed).toBeTruthy();
  });
});

describe('support links report failure', () => {
  type Support = typeof SupportModule;

  /** Loads the support service against a stubbed `expo-linking`. */
  function withLinking(openURL: () => Promise<unknown>): Support['support'] {
    let loaded: Support['support'] | undefined;
    jest.isolateModules(() => {
      jest.doMock('expo-linking', () => ({ openURL: jest.fn(openURL), openSettings: jest.fn() }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = (require('@/services/support') as Support).support;
    });
    return loaded as Support['support'];
  }

  it('answers false when the device cannot open the channel', async () => {
    const support = withLinking(async () => {
      throw new Error('No app to handle the URL');
    });
    await expect(support.whatsapp({ reason: 'password' })).resolves.toBe(false);
  });

  it('answers true when it opened', async () => {
    const support = withLinking(async () => true);
    await expect(support.email({ reason: 'password' })).resolves.toBe(true);
  });
});

describe('registration password policy mirrors the backend', () => {
  it.each(['GoodPass1', 'Granite7Harbor', 'كلمةسرية2024', 'Ahmedabc١٢'])('accepts %s', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ['too short', 'short1A', 'validation.passwordMin'],
    ['Arabic-Indic digits are not letters', '١١١١١١١1', 'validation.passwordLower'],
    ['a number with two letters attached', 'Aa123456', 'validation.passwordCommon'],
    ['a well-known password', 'Password1', 'validation.passwordCommon'],
    ['too few different characters', 'Aa1Aa1Aa1', 'validation.passwordCommon'],
  ])('rejects %s', (_label, value, message) => {
    const result = passwordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(message);
  });
});
