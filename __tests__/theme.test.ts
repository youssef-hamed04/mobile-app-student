import fs from 'fs';
import path from 'path';

import { darkPalette, lightPalette } from '@/theme/palette';

/**
 * palette.ts is a typed mirror of the CSS variables in global.css. They are
 * two files that must agree, and a drift between them shows up as a native
 * status bar or video-chrome colour that doesn't match the rest of the UI —
 * a bug that's easy to ship and hard to notice. This test makes the drift
 * loud.
 */

const css = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'theme', 'global.css'),
  'utf8'
);

/** "--color-surface-alt: 247 247 248;" -> { 'surface-alt': '#F7F7F8' } */
function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);

  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = /--color-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+);/.exec(line);
    if (!m) continue;
    const [, name, r, g, b] = m;
    out[name!] = `#${[r, g, b]
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase();
  }
  return out;
}

const camel = (kebab: string) =>
  kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

describe('theme tokens', () => {
  const light = readBlock(':root');
  const dark = readBlock('.dark:root');

  it('defines the same token set in both themes', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it('light CSS variables match lightPalette', () => {
    for (const [name, hex] of Object.entries(light)) {
      const key = camel(name) as keyof typeof lightPalette;
      expect(`${key}=${lightPalette[key]?.toUpperCase()}`).toBe(`${key}=${hex}`);
    }
  });

  it('dark CSS variables match darkPalette', () => {
    for (const [name, hex] of Object.entries(dark)) {
      const key = camel(name) as keyof typeof darkPalette;
      expect(`${key}=${darkPalette[key]?.toUpperCase()}`).toBe(`${key}=${hex}`);
    }
  });

  it('light and dark are genuinely different palettes, not an inversion', () => {
    // A naive inversion would make dark.foreground === light.background.
    // The design intentionally uses warm off-black / off-white instead.
    expect(darkPalette.background).not.toBe(lightPalette.foreground);
    expect(darkPalette.foreground).not.toBe(lightPalette.background);
    // Primary is lifted in dark mode for contrast against dark surfaces.
    expect(darkPalette.primary).not.toBe(lightPalette.primary);
  });
});

/** Relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('contrast (WCAG AA)', () => {
  const cases: [string, string, string, number][] = [
    ['light body text', lightPalette.foreground, lightPalette.background, 4.5],
    ['light muted text', lightPalette.muted, lightPalette.background, 4.5],
    ['light primary button', lightPalette.primaryFg, lightPalette.primary, 4.5],
    ['light accent button', lightPalette.accentFg, lightPalette.accent, 4.5],
    ['dark body text', darkPalette.foreground, darkPalette.background, 4.5],
    ['dark muted text', darkPalette.muted, darkPalette.surface, 4.5],
    ['dark primary button', darkPalette.primaryFg, darkPalette.primary, 4.5],
    ['dark accent button', darkPalette.accentFg, darkPalette.accent, 4.5],
    // Large text / UI affordances only need 3:1.
    ['light primary on surface', lightPalette.primary, lightPalette.surface, 3],
    ['dark primary on surface', darkPalette.primary, darkPalette.surface, 3],
  ];

  it.each(cases)('%s meets %s:1', (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

/**
 * Dark mode has to stay complete, not just start complete.
 *
 * The test above already pins palette.ts against global.css. This one pins the
 * other failure mode: a token added to `:root` and forgotten under `.dark`.
 * That does not break the build and does not break light mode — it produces
 * one element that is unreadable in dark mode and nowhere else, which is
 * exactly the kind of report that is hard to chase down after the fact.
 */
describe('every colour token is defined for both themes', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'theme', 'global.css'),
    'utf8'
  );

  function varsIn(pattern: RegExp): Set<string> {
    const block = pattern.exec(css);
    // Thrown rather than `expect`ed and then non-null asserted: under
    // `noUncheckedIndexedAccess` the capture group is `string | undefined`
    // whatever the assertion said, and a throw narrows it honestly.
    if (!block) throw new Error(`no CSS block matched ${String(pattern)}`);
    const body = block[1];
    if (body === undefined) throw new Error('the CSS block captured no body');
    const names = body.match(/--color-[a-z-]+(?=\s*:)/g) ?? [];
    return new Set(names);
  }

  const light = varsIn(/:root\s*\{([\s\S]*?)\}/);
  const dark = varsIn(/\.dark:root,\s*\.dark\s*\{([\s\S]*?)\}/);

  it('defines at least the full semantic set in light mode', () => {
    // A floor rather than an exact number, so adding a token is not a test
    // failure — only forgetting its dark counterpart is.
    expect(light.size).toBeGreaterThanOrEqual(20);
  });

  it('rebinds every light token under .dark', () => {
    const missing = [...light].filter((name) => !dark.has(name));
    expect(missing).toEqual([]);
  });

  it('introduces no dark-only token', () => {
    // A token that exists only under `.dark` resolves to nothing in light
    // mode, which is the same bug pointing the other way.
    const extra = [...dark].filter((name) => !light.has(name));
    expect(extra).toEqual([]);
  });
});
