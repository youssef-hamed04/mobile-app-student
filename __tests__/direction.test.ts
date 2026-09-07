import {
  backChevron,
  bidiIsolate,
  directionSign,
  forwardChevron,
} from '@/i18n/direction';
import { isRTLLanguage, RTL_LANGUAGES, SUPPORTED_LANGUAGES } from '@/store/language-store';
import { ICONS } from '@/components/ui/Icon';

describe('language configuration', () => {
  it('ships both required languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('ar');
  });

  it('marks only Arabic as RTL', () => {
    expect(isRTLLanguage('ar')).toBe(true);
    expect(isRTLLanguage('en')).toBe(false);
    expect(RTL_LANGUAGES).toEqual(['ar']);
  });
});

describe('direction helpers', () => {
  it('flips the sign for translate/velocity maths', () => {
    expect(directionSign(false)).toBe(1);
    expect(directionSign(true)).toBe(-1);
  });

  it('points "forward" and "back" the right way in each direction', () => {
    expect(forwardChevron(false)).toBe('chevron-right');
    expect(forwardChevron(true)).toBe('chevron-left');
    expect(backChevron(false)).toBe('chevron-left');
    expect(backChevron(true)).toBe('chevron-right');
  });

  it('never returns the same glyph for forward and back', () => {
    for (const rtl of [true, false]) {
      expect(forwardChevron(rtl)).not.toBe(backChevron(rtl));
    }
  });

  it('isolates embedded latin/numeric runs', () => {
    const wrapped = bidiIsolate(1080);
    expect(wrapped.startsWith('⁨')).toBe(true);
    expect(wrapped.endsWith('⁩')).toBe(true);
  });
});

describe('icon set', () => {
  it('exposes the transport controls that must not mirror', () => {
    // These are asserted here because the "never mirror" rule lives in
    // Icon.tsx and silently breaking it would flip seek direction in Arabic.
    expect(ICONS).toHaveProperty('forward10');
    expect(ICONS).toHaveProperty('back10');
  });

  it('maps every alias to a real glyph name', () => {
    for (const [alias, glyph] of Object.entries(ICONS)) {
      expect(typeof glyph).toBe('string');
      expect(glyph.length).toBeGreaterThan(0);
      expect(alias.length).toBeGreaterThan(0);
    }
  });
});
