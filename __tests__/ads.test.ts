import { resolveAdTarget } from '@/features/ads/target';
import type { AdTarget } from '@/types/domain';

/**
 * Ad destinations are admin-authored content travelling over the API, so
 * `resolveAdTarget` is a trust boundary rather than a formatting helper. These
 * cases pin the two ways a banner could otherwise be used to redirect a
 * student somewhere the app never intended to send them.
 */

const target = (t: Partial<AdTarget>): AdTarget => ({
  type: 'NONE',
  entityId: null,
  url: null,
  ...t,
});

describe('resolveAdTarget', () => {
  it('routes entity targets to their existing app routes', () => {
    expect(resolveAdTarget(target({ type: 'COURSE', entityId: 'c1' }))).toEqual({
      kind: 'internal',
      href: '/course/c1',
    });
    expect(resolveAdTarget(target({ type: 'LESSON', entityId: 'l9' }))).toEqual({
      kind: 'internal',
      href: '/lesson/l9',
    });
  });

  it('renders inert when an entity target carries no id', () => {
    expect(resolveAdTarget(target({ type: 'COURSE' }))).toBeNull();
    expect(resolveAdTarget(target({ type: 'LESSON' }))).toBeNull();
  });

  it('passes through server-supplied in-app paths', () => {
    for (const type of ['APP_SCREEN', 'SECTION'] as const) {
      expect(resolveAdTarget(target({ type, url: '/(tabs)/courses' }))).toEqual({
        kind: 'internal',
        href: '/(tabs)/courses',
      });
    }
  });

  it('rejects protocol-relative paths posing as internal routes', () => {
    // `//evil.com` starts with a slash but is an absolute URL to another host.
    expect(resolveAdTarget(target({ type: 'APP_SCREEN', url: '//evil.com' }))).toBeNull();
    expect(resolveAdTarget(target({ type: 'SECTION', url: '//evil.com' }))).toBeNull();
    expect(
      resolveAdTarget(target({ type: 'APP_SCREEN', url: 'https://evil.com' }))
    ).toBeNull();
  });

  it('opens external links only over http(s)', () => {
    expect(
      resolveAdTarget(target({ type: 'EXTERNAL_URL', url: 'https://example.com/x' }))
    ).toEqual({ kind: 'external', url: 'https://example.com/x' });

    for (const url of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'eduplatform://course/c1',
      'not a url',
    ]) {
      expect(resolveAdTarget(target({ type: 'EXTERNAL_URL', url }))).toBeNull();
    }
  });

  it('is inert for NONE and for target types it does not know', () => {
    expect(resolveAdTarget(target({ type: 'NONE' }))).toBeNull();
    expect(
      resolveAdTarget(target({ type: 'SOMETHING_NEW' as AdTarget['type'] }))
    ).toBeNull();
  });
});
