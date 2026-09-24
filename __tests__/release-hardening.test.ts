import { Endpoints } from '@/api/endpoints';
import { networkError } from '@/api/errors';
import { isSafeInternalRoute } from '@/utils/guards';

import en from '../src/i18n/locales/en.json';
import ar from '../src/i18n/locales/ar.json';

describe('transport failures are classified, not all reported as offline', () => {
  it.each([
    ['offline', 'NETWORK_OFFLINE'],
    ['timeout', 'NETWORK_TIMEOUT'],
    ['unreachable', 'SERVER_UNREACHABLE'],
  ] as const)('%s → %s', (kind, code) => {
    const err = networkError(kind);
    expect(err.code).toBe(code);
    expect(err.status).toBe(0);
    expect(err.retryable).toBe(true);
  });

  it('has a student-facing message for SERVER_UNREACHABLE in both languages', () => {
    expect(en.errors.SERVER_UNREACHABLE).toBeTruthy();
    expect(ar.errors.SERVER_UNREACHABLE).toBeTruthy();
  });
});

describe('notification deep links', () => {
  it.each(['/library', '/library/abc123', '/wallet', '/support/t_1'])(
    'allows in-app route %s',
    (route) => expect(isSafeInternalRoute(route)).toBe(true)
  );

  it.each(['https://evil.example/x', '//evil', '/library/../../x', 'eduplatform://course/1'])(
    'rejects %s',
    (route) => expect(isSafeInternalRoute(route)).toBe(false)
  );
});

describe('push token unregister path', () => {
  it('percent-encodes Expo token brackets into one path segment', () => {
    expect(Endpoints.notifications.unregisterPushToken('ExponentPushToken[ab/c]')).toBe(
      '/notifications/devices/ExponentPushToken%5Bab%2Fc%5D'
    );
  });
});

describe('account deletion copy', () => {
  it('exists at parity in English and Arabic', () => {
    expect(Object.keys(ar.deleteAccount).sort()).toEqual(Object.keys(en.deleteAccount).sort());
  });
});
