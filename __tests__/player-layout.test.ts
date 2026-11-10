import {
  DEFAULT_ASPECT,
  PORTRAIT_BAND_MAX_RATIO,
  aspectFromTrack,
  isImmersive,
  surfaceFor,
} from '@/features/video/layout';

/**
 * The portrait player's geometry on real phone sizes (logical dp).
 *
 *   small   360 x 640   (older 16:9 budget phones)
 *   medium  360 x 780   (19.5:9, the common shape)
 *   large   412 x 915   (Pixel 7 Pro class)
 *   tablet  800 x 1280
 */
const PHONES = {
  small: { width: 360, height: 640 },
  medium: { width: 360, height: 780 },
  large: { width: 412, height: 915 },
  tablet: { width: 800, height: 1280 },
};

describe('portrait band', () => {
  it.each(Object.entries(PHONES))('fills the width for a 16:9 lecture on a %s phone', (_, phone) => {
    const s = surfaceFor({ ...phone, immersive: false, aspect: 16 / 9 });
    expect(s.width).toBe(phone.width);
    expect(s.height).toBe(Math.round(phone.width / (16 / 9)));
  });

  it('assumes 16:9 until the track reports its shape', () => {
    const assumed = surfaceFor({ ...PHONES.medium, immersive: false, aspect: null });
    const explicit = surfaceFor({ ...PHONES.medium, immersive: false, aspect: DEFAULT_ASPECT });
    expect(assumed).toEqual(explicit);
  });

  it('gives a 4:3 recording a taller band instead of forcing 16:9 bars onto it', () => {
    const wide = surfaceFor({ ...PHONES.medium, immersive: false, aspect: 16 / 9 });
    const classic = surfaceFor({ ...PHONES.medium, immersive: false, aspect: 4 / 3 });
    expect(classic.height).toBeGreaterThan(wide.height);
    expect(classic.width).toBe(PHONES.medium.width);
  });

  it('never lets the band crowd out the header and the dock', () => {
    for (const phone of Object.values(PHONES)) {
      for (const aspect of [1, 4 / 3, 16 / 9, 2.4]) {
        const s = surfaceFor({ ...phone, immersive: false, aspect });
        expect(s.height).toBeLessThanOrEqual(Math.round(phone.height * PORTRAIT_BAND_MAX_RATIO));
        expect(s.width).toBeLessThanOrEqual(phone.width);
      }
    }
  });

  it('caps a square source by height and centres it with side bars, cropping nothing', () => {
    const s = surfaceFor({ ...PHONES.small, immersive: false, aspect: 1 });
    expect(s.height).toBe(Math.round(PHONES.small.height * PORTRAIT_BAND_MAX_RATIO));
    expect(s.width).toBe(s.height); // still square: the picture is not stretched
    expect(s.width).toBeLessThan(PHONES.small.width);
  });

  it('keeps the picture at its own aspect ratio within a pixel', () => {
    for (const phone of Object.values(PHONES)) {
      for (const aspect of [4 / 3, 16 / 9, 2.4]) {
        const s = surfaceFor({ ...phone, immersive: false, aspect });
        expect(Math.abs(s.width / s.height - aspect)).toBeLessThan(0.02);
      }
    }
  });
});

describe('immersive layout', () => {
  it('fills the screen in fullscreen', () => {
    expect(surfaceFor({ width: 780, height: 360, immersive: true, aspect: 16 / 9 })).toEqual({
      width: 780,
      height: 360,
    });
  });

  it('is used when the phone is held sideways even without tapping fullscreen', () => {
    expect(isImmersive({ width: 780, height: 360, fullscreen: false })).toBe(true);
    expect(isImmersive({ width: 360, height: 780, fullscreen: false })).toBe(false);
    expect(isImmersive({ width: 360, height: 780, fullscreen: true })).toBe(true);
  });
});

describe('aspect from the loaded track', () => {
  it('reads a sane size', () => {
    expect(aspectFromTrack({ width: 1920, height: 1080 })).toBeCloseTo(16 / 9, 5);
    expect(aspectFromTrack({ width: 640, height: 480 })).toBeCloseTo(4 / 3, 5);
  });

  it('ignores a missing or nonsense size', () => {
    expect(aspectFromTrack(null)).toBeNull();
    expect(aspectFromTrack(undefined)).toBeNull();
    expect(aspectFromTrack({ width: 0, height: 1080 })).toBeNull();
    expect(aspectFromTrack({ width: Number.NaN, height: 1080 })).toBeNull();
  });

  it('clamps a portrait recording to square and an ultra-wide one to 2.4', () => {
    expect(aspectFromTrack({ width: 1080, height: 1920 })).toBe(1);
    expect(aspectFromTrack({ width: 4000, height: 1000 })).toBe(2.4);
  });
});
