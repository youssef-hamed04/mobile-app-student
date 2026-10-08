/**
 * AsyncStorage is not encrypted, so the persisted query cache is a plaintext
 * file on the device. These tests pin down exactly which records may reach it.
 *
 * The failure this guards against is silent: a personal record nested under a
 * public root (`courses` also serves the catalog) would be persisted, readable
 * off a lost or shared device, with nothing failing in CI to announce it.
 */
import { persistOptions } from '@/api/query-client';
import { qk } from '@/api/query-keys';

// The persister is constructed at module scope with AsyncStorage, which needs
// the package's own jest mock under the jest-expo preset.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const shouldPersist = (queryKey: readonly unknown[]) =>
  persistOptions.dehydrateOptions.shouldDehydrateQuery({ queryKey } as never);

describe('credentials and signed URLs never reach AsyncStorage', () => {
  it.each([
    ['auth session', qk.auth.me()],
    ['auth token refresh', qk.auth.session()],
    ['playback ticket', qk.playback.ticket('v1')],
    ['attachment ticket', qk.attachments.ticket('a1')],
    ['reading ticket', qk.library.document('p1')],
  ] as const)('excludes %s', (_label, key) => {
    expect(shouldPersist(key)).toBe(false);
  });
});

describe('personal records stay in memory only', () => {
  it.each([
    ['wallet summary', qk.wallet.summary()],
    ['wallet transactions', qk.wallet.transactions({ page: 1 })],
    ['enrolled courses', qk.courses.mine({ page: 1 })],
    ['course progress', qk.courses.progress('c1')],
    ['owned course parts', qk.courses.myParts({ page: 1 })],
    ['play allowance', qk.courses.playAllowance('v1')],
    ['purchased library items', qk.library.mine({ page: 1 })],
    ['library purchases', qk.library.purchases({ page: 1 })],
    ['notifications', qk.notifications.list({ page: 1 })],
    ['notification preferences', qk.notifications.preferences()],
    ['watch history', qk.progress.continueWatching()],
    ['registered devices', qk.devices.list()],
    ['support tickets', qk.support.tickets({ page: 1 })],
  ] as const)('excludes %s', (_label, key) => {
    expect(shouldPersist(key)).toBe(false);
  });
});

describe('public catalog stays cached offline', () => {
  it.each([
    ['universities', qk.catalog.universities()],
    ['faculties', qk.catalog.faculties('u1')],
    ['course detail', qk.courses.detail('c1')],
    ['course parts', qk.courses.parts('c1')],
    ['join options', qk.courses.joinOptions('c1')],
    ['library browse', qk.library.browse({ page: 1 })],
    ['library material', qk.library.material('p1')],
    ['home feed', qk.home.feed()],
  ] as const)('persists %s', (_label, key) => {
    expect(shouldPersist(key)).toBe(true);
  });
});

describe('persistence matching is prefix-safe', () => {
  it('does not exclude a public sibling that merely shares a name', () => {
    expect(shouldPersist(['courses', 'detail', 'c1'])).toBe(true);
    expect(shouldPersist(['library', 'browse'])).toBe(true);
  });

  it('does not let a deeper key re-enter a denied prefix', () => {
    expect(shouldPersist(['auth', 'me', 'extra', 'deeper'])).toBe(false);
    expect(shouldPersist(['courses', 'mine', { page: 2 }])).toBe(false);
  });

  it('rejects non-string roots instead of persisting them blindly', () => {
    expect(shouldPersist([{ nested: 'object' }])).toBe(false);
    expect(shouldPersist([])).toBe(false);
  });
});