import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';
import * as React from 'react';

import { Text } from '@/components/ui/Text';
import { palettes } from '@/theme/palette';

/**
 * The sign-in and registration screens sit on the orange plate in both themes.
 * Found on the installed release build in dark mode: the language toggle was a
 * black pill with black content, and fixed inks such as `text-brand-900` came
 * out near-white, because `text-foreground` from the default tone won. These
 * tests hold the fix at the source and token level. They do not render a device.
 */
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('auth plate in dark mode', () => {
  it('tone="none" leaves only the colour the caller set', () => {
    render(
      <Text tone="none" className="text-brand-900">
        ink
      </Text>
    );
    const { className } = screen.getByText('ink').props as { className: string };
    expect(className).toContain('text-brand-900');
    expect(className).not.toContain('text-foreground');
  });

  it.each(['src/app/(auth)/login.tsx', 'src/app/(auth)/register.tsx'])(
    '%s has no fixed ink that the default tone would override',
    (file) => {
      const tags = read(file).match(/<Text\b[^>]*>/g) ?? [];
      const inked = tags.filter((tag) => /text-(brand|danger)-\d+/.test(tag));
      expect(inked.length).toBeGreaterThan(0);
      for (const tag of inked) expect(tag).toContain('tone="none"');
    }
  );

  it.each(['src/components/ui/Input.tsx', 'src/components/ui/Select.tsx'])(
    '%s keeps a readable error label on the plate',
    (file) => {
      const source = read(file);
      expect(source).toContain("tone={error ? (onPlate ? 'none' : 'accent')");
      expect(source).toContain("error && onPlate ? 'text-danger-800'");
    }
  );

  it('the language toggle stays a white pill with dark ink', () => {
    const source = read('src/components/layout/LanguageToggle.tsx');
    expect(source).toContain('bg-ink-0');
    expect(source).not.toContain('bg-surface');
    expect(source).toContain('tone="onHighlight"');
  });

  it('the plate inks meet WCAG AA on the plate', () => {
    const plate = palettes.dark.highlight;
    expect(contrast('#4E3009', plate)).toBeGreaterThanOrEqual(4.5); // brand-900
    expect(contrast('#700F13', plate)).toBeGreaterThanOrEqual(4.5); // danger-800
    expect(contrast(palettes.dark.highlightFg, '#FFFFFF')).toBeGreaterThanOrEqual(4.5); // toggle
  });

  it('dark-mode foreground would fail on the plate, which is why the tone matters', () => {
    expect(contrast(palettes.dark.foreground, palettes.dark.highlight)).toBeLessThan(3);
  });
});

describe('field labels', () => {
  it.each(['src/components/ui/Input.tsx', 'src/components/ui/Select.tsx'])(
    '%s keeps the required mark inside the label text',
    (file) => {
      // Found on the release build: a content-sized Arabic label lost its last word.
      const source = read(file);
      expect(source).not.toContain('accessibilityElementsHidden');
      expect(source).toContain("{' *'}");
      expect(source).toContain('accessibilityLabel={label}');
    }
  );
});

describe('tab bar on Android', () => {
  it('clears the system navigation bar', () => {
    // Found on the installed release build with three-button navigation: the
    // system bar covered the tab labels and took their taps.
    const source = read('src/app/(tabs)/_layout.tsx');
    expect(source).toContain('68 + insets.bottom');
    expect(source).toContain('10 + insets.bottom');
  });
});
