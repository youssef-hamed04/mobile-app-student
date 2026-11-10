import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Owner decision D4 (Android first, iOS later; no StoreKit, no price hiding).
 *
 * The store builds must not sell digital content outside the store's billing.
 * The one screen that could - `EnrollSheet.tsx`, which opened
 * `payment.checkoutUrl` in the browser - was never imported and was removed.
 * This keeps a checkout from coming back unnoticed. The mock API (`src/api/mock`)
 * is development-only and excluded.
 */

const SRC = join(__dirname, '..', 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return full.includes(join('src', 'api', 'mock')) ? [] : walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });

describe('no external checkout in the app', () => {
  it('the removed EnrollSheet stays removed', () => {
    expect(existsSync(join(SRC, 'features', 'enrollment', 'EnrollSheet.tsx'))).toBe(false);
  });

  it('no screen opens a payment checkout URL', () => {
    const offenders = walk(SRC).filter((file) => {
      if (file.endsWith(join('types', 'domain.ts'))) return false; // the wire type only
      return /checkoutUrl/.test(readFileSync(file, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });
});
