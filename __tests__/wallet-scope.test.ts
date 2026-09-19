import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';

/**
 * The product's single most consequential rule, enforced structurally.
 *
 * **Wallet credit is for the Library and nothing else.** Courses and course
 * parts are unlocked with access cards, paid for offline. A wallet debit
 * introduced anywhere in the course path would take money from a student for
 * something the backend does not charge for, and no amount of careful review
 * catches that reliably on the tenth edit.
 *
 * So the rule is asserted against the source itself: the course and part
 * features may not import the wallet, and their code may not mention a balance.
 * This is a coarse check on purpose — it fails loudly on the first attempt to
 * wire the two together, which is exactly when it is cheap to reconsider.
 */

const SRC = join(__dirname, '..', 'src');

const COURSE_SIDE = [
  'features/courses/api.ts',
  'features/courses/hooks.ts',
  'features/course-parts/api.ts',
  'features/course-parts/hooks.ts',
  'features/course-parts/PartsPanel.tsx',
  'features/enrollment/EnrollSheet.tsx',
];

const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

describe('wallet scope', () => {
  it.each(COURSE_SIDE)('%s does not reach for the wallet', (rel) => {
    const source = read(rel);

    expect(source).not.toMatch(/from '@\/features\/wallet/);
    expect(source).not.toMatch(/Endpoints\.wallet/);
    expect(source).not.toMatch(/qk\.wallet/);
  });

  /**
   * The Library is the one place that may spend credit, and it must actually
   * do so — a Library that silently stopped debiting would be giving content
   * away.
   */
  it('the library is where credit is spent', () => {
    const source = read('features/library/hooks.ts');
    expect(source).toMatch(/qk\.wallet/);
  });

  it('the wallet never imports a course feature', () => {
    for (const rel of ['features/wallet/api.ts', 'features/wallet/hooks.ts']) {
      expect(read(rel)).not.toMatch(/from '@\/features\/(courses|course-parts)/);
    }
  });
});

describe('scope is explained to the student, not just enforced', () => {
  /**
   * Students arrive at a balance expecting it to buy courses, because that is
   * how most platforms work. The screen says otherwise in both languages;
   * these assert the sentences exist rather than that they say something in
   * particular.
   *
   * Read off the imported bundles directly rather than through an index
   * signature: `resolveJsonModule` types these as literals, and widening them
   * to `Record<string, string>` is both a lie (the tree is nested) and the
   * thing that makes every lookup `| undefined` under
   * `noUncheckedIndexedAccess`.
   */
  it('explains in English what credit is for', () => {
    expect(en.wallet.scopeTitle).toBeTruthy();
    expect(en.wallet.scopeBody.length).toBeGreaterThan(30);
  });

  it('explains in Arabic what credit is for', () => {
    expect(ar.wallet.scopeTitle).toBeTruthy();
    expect(ar.wallet.scopeBody.length).toBeGreaterThan(30);
  });

  it('explains how a course part is unlocked, without mentioning credit', () => {
    expect(en.parts.howToUnlockBody).toMatch(/access card/i);
    expect(en.parts.howToUnlockBody).not.toMatch(/\bbalance\b/i);
  });
});

describe('translations', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
          flatten(v, prefix ? `${prefix}.${k}` : k)
        )
      : [prefix];

  /**
   * Arabic is not a fallback language here — it is the primary one for most of
   * these students. A key present only in English ships as a raw dotted path.
   */
  it('has an Arabic string for every English one', () => {
    const arabic = new Set(flatten(ar));
    const missing = flatten(en).filter((key) => !arabic.has(key));

    expect(missing).toEqual([]);
  });
});
