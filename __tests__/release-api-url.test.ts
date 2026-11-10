import { assertReleaseApiUrl } from '@/config/env';

/**
 * A release bundle (store build, staging build or OTA update) must never start
 * against a local or plain-HTTP API. The build-time guard does not cover
 * `eas update`, so this runtime check is the backstop.
 */
describe('assertReleaseApiUrl', () => {
  it.each([
    'http://10.0.2.2:3000/api/v1',
    'http://localhost:3000/api/v1',
    'https://127.0.0.1/api/v1',
    'https://192.168.1.20/api/v1',
    'https://10.1.2.3/api/v1',
    'https://172.20.0.5/api/v1',
    'http://student-backend-814y.onrender.com/api/v1',
  ])('refuses %s in a release bundle', (url) => {
    expect(() => assertReleaseApiUrl(url, true)).toThrow(/Refusing to start a release build/);
  });

  it('accepts the real HTTPS API in a release bundle', () => {
    expect(() =>
      assertReleaseApiUrl('https://student-backend-814y.onrender.com/api/v1', true)
    ).not.toThrow();
  });

  it('allows local URLs in development bundles', () => {
    expect(() => assertReleaseApiUrl('http://10.0.2.2:3000/api/v1', false)).not.toThrow();
  });
});
