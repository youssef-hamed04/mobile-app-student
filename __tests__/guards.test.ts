import { clamp, isSafeInternalRoute, safeJson } from '@/utils/guards';
import { formatTimecode, initials, maskPhone } from '@/utils/format';

/**
 * Push payloads and search results carry a `route` that comes off the
 * network. Handing one straight to router.push would let a crafted payload
 * open an external URL or a native scheme, so it goes through an allow-list.
 */
describe('isSafeInternalRoute', () => {
  it.each([
    '/course/c1',
    '/lesson/l12',
    '/player/v-l12',
    '/settings/security',
    '/notifications',
  ])('accepts %s', (route) => {
    expect(isSafeInternalRoute(route)).toBe(true);
  });

  it.each([
    'https://evil.example.com',
    'javascript:alert(1)',
    'eduplatform://course/c1',
    '/course/../../etc/passwd',
    '/admin/users',
    '//evil.example.com',
    '',
    null,
    undefined,
  ])('rejects %s', (route) => {
    expect(isSafeInternalRoute(route as string | null)).toBe(false);
  });
});

describe('safeJson', () => {
  it('returns the fallback instead of throwing on malformed input', () => {
    expect(safeJson('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJson('not json', { fallback: true })).toEqual({ fallback: true });
    expect(safeJson(null, [])).toEqual([]);
  });
});

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});

describe('formatting', () => {
  it('formats timecodes with latin digits regardless of locale', () => {
    expect(formatTimecode(0)).toBe('0:00');
    expect(formatTimecode(65)).toBe('1:05');
    expect(formatTimecode(3725)).toBe('1:02:05');
    expect(formatTimecode(-10)).toBe('0:00');
    expect(formatTimecode(NaN)).toBe('0:00');
  });

  it('derives avatar initials from the first two name parts', () => {
    expect(initials('Ahmed Mohamed Ali')).toBe('AM');
    expect(initials('Ahmed')).toBe('A');
    expect(initials('  ')).toBe('');
  });

  it('masks the middle of a phone number', () => {
    const masked = maskPhone('01001234567');
    expect(masked.startsWith('0100')).toBe(true);
    expect(masked.endsWith('567')).toBe(true);
    expect(masked).toContain('*');
  });
});
