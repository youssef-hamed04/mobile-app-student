import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';

/**
 * A missing Arabic key doesn't crash — it silently falls back to English,
 * which ships an English string into an Arabic screen. That's exactly the
 * kind of defect nobody notices until a student reports it, so it's asserted
 * here instead.
 */
type Json = { [k: string]: string | Json };

function flatten(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'string' ? [key] : flatten(v, key);
  });
}

const enKeys = flatten(en as unknown as Json).sort();
const arKeys = flatten(ar as unknown as Json).sort();

/** Arabic uses six plural categories; English uses two. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const base = (k: string) => k.replace(PLURAL_SUFFIX, '');

describe('translation bundles', () => {
  it('has a substantial number of strings', () => {
    expect(enKeys.length).toBeGreaterThan(250);
  });

  it('covers every English key in Arabic', () => {
    const arBases = new Set(arKeys.map(base));
    const missing = enKeys.map(base).filter((k) => !arBases.has(k));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('has no Arabic keys that English lacks', () => {
    const enBases = new Set(enKeys.map(base));
    const extra = arKeys.map(base).filter((k) => !enBases.has(k));
    expect([...new Set(extra)]).toEqual([]);
  });

  it('keeps interpolation placeholders identical across languages', () => {
    const placeholders = (s: string) =>
      (s.match(/\{\{(\w+)\}\}/g) ?? []).sort().join(',');

    const flat = (obj: Json, prefix = ''): Record<string, string> =>
      Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') acc[key] = v;
        else Object.assign(acc, flat(v, key));
        return acc;
      }, {});

    const enFlat = flat(en as unknown as Json);
    const arFlat = flat(ar as unknown as Json);

    const mismatches: string[] = [];
    for (const [key, value] of Object.entries(enFlat)) {
      const other = arFlat[key];
      if (!other) continue;
      // Plural variants are exempt: Arabic's `_one` / `_two` forms spell the
      // count as a word ("درس واحد") rather than interpolating it, which is
      // correct Arabic and not a translation bug.
      if (PLURAL_SUFFIX.test(key)) continue;
      if (placeholders(value) !== placeholders(other)) mismatches.push(key);
    }
    expect(mismatches).toEqual([]);
  });

  it('actually contains Arabic script, not copied English', () => {
    const arabic = /[؀-ۿ]/;
    const suspicious = ['auth.welcomeBack', 'tabs.home', 'courses.title'];
    for (const key of suspicious) {
      const value = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Json)[k], ar as unknown);
      expect(arabic.test(String(value))).toBe(true);
    }
  });
});
