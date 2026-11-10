/* eslint-disable @typescript-eslint/no-require-imports -- isolateModules needs a fresh require */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isAnnouncementVisible,
  isRouteEnabled,
  isSalesMessaging,
  resolveReleaseFeatures,
  type ReleaseFeatures,
} from '@/config/release-features';

/**
 * The Google Play first-release configuration itself.
 *
 * These pass under both Jest presets. Platform behavior is resolved explicitly,
 * or by loading the real modules with the platform set.
 */
const OFF: ReleaseFeatures = {
  library: false,
  wallet: false,
  courseActivation: false,
  coursePrices: false,
  digitalPurchases: false,
};
const android = resolveReleaseFeatures('android', OFF);

const root = join(__dirname, '..');

describe('Android release flags', () => {
  it('turns everything off on Android when the variables are absent', () => {
    jest.isolateModules(() => {
      const { Platform } = require('react-native');
      const original = Platform.OS;
      Platform.OS = 'android';
      try {
        const real = require('@/config/release-features');
        expect(real.releaseFeatures).toEqual(OFF);
      } finally {
        Platform.OS = original;
      }
    });
  });

  it('keeps the commercial variables false and the library on in the production EAS profile, inherited by the APK', () => {
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    const env = eas.build.production.env;
    for (const name of [
      'EXPO_PUBLIC_ENABLE_WALLET',
      'EXPO_PUBLIC_ENABLE_COURSE_ACTIVATION',
      'EXPO_PUBLIC_SHOW_COURSE_PRICES',
      'EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES',
    ]) {
      expect(env[name]).toBe('false');
    }
    // Reading materials on the account is content, so the library ships on.
    expect(env.EXPO_PUBLIC_ENABLE_LIBRARY).toBe('true');
    expect(eas.build['production:apk'].extends).toBe('production');
    expect(eas.build['production:apk'].env).toBeUndefined();
  });
});

/** Loads the real modules with the platform set, so this holds under either Jest preset. */
function loadOn(platform: 'ios' | 'android') {
  let loaded!: {
    features: ReleaseFeatures;
    isSafeInternalRoute: (route: string) => boolean;
    isAnnouncementVisible: typeof isAnnouncementVisible;
  };
  jest.isolateModules(() => {
    const { Platform } = require('react-native');
    Platform.OS = platform;
    const real = require('@/config/release-features');
    loaded = {
      features: real.releaseFeatures,
      isSafeInternalRoute: require('@/utils/guards').isSafeInternalRoute,
      isAnnouncementVisible: real.isAnnouncementVisible,
    };
  });
  return loaded;
}

describe('iOS is consumption-only too (owner decision 2026-11-10)', () => {
  const ON: ReleaseFeatures = {
    library: true,
    wallet: true,
    courseActivation: true,
    coursePrices: true,
    digitalPurchases: true,
  };

  it('ignores the platform: the commercial flags are false even if the variables say on', () => {
    for (const platform of ['ios', 'android', 'web', 'anything']) {
      expect(resolveReleaseFeatures(platform, ON)).toEqual({ ...OFF, library: true });
      expect(resolveReleaseFeatures(platform, OFF)).toEqual(OFF);
    }
    expect(loadOn('ios').features).toEqual(OFF);
  });

  it('never opens the wallet route; the library follows its own switch', () => {
    const { isSafeInternalRoute: guard, features } = loadOn('ios');
    expect(guard('/wallet')).toBe(false);
    expect(guard('/library')).toBe(features.library);
    expect(guard('/library/m1')).toBe(features.library);
  });
});

describe('the same real modules on Android', () => {
  it('turn every feature off and refuse the routes', () => {
    const { features, isSafeInternalRoute: guard } = loadOn('android');
    expect(features).toEqual(OFF);
    expect(guard('/library')).toBe(false);
    expect(guard('/library/reader/p1')).toBe(false);
    expect(guard('/wallet')).toBe(false);
    expect(guard('/lesson/l1')).toBe(true);
    expect(guard('/viewer/a1')).toBe(true);
  });
});

describe('route guard on Android', () => {
  it.each([
    '/library',
    '/library/',
    '/library/m1',
    '/library/reader/p1',
    '/wallet',
    '/wallet/',
    '/WALLET',
    '/(tabs)/library',
    'eduplatform://wallet',
    'eduplatform://library/m1',
    '/library?x=1',
    '/wallet#top',
  ])('blocks %s', (route) => {
    expect(isRouteEnabled(route, android)).toBe(false);
  });

  it.each([
    '/course/c1',
    '/lesson/l1',
    '/player/v1',
    '/viewer/a1',
    '/notifications',
    '/settings',
    '/support',
    '/search',
    '/courses?teacherId=t1',
    '/libraryish',
  ])('allows %s', (route) => {
    expect(isRouteEnabled(route, android)).toBe(true);
  });
});

describe('announcements on Android', () => {
  const visible = (item: Parameters<typeof isAnnouncementVisible>[0]) =>
    isAnnouncementVisible(item, android);

  it('keeps neutral educational announcements', () => {
    expect(visible({ kind: 'ANNOUNCEMENT', title: 'Mid-term timetable', body: 'Published.' })).toBe(true);
    expect(visible({ kind: 'NEW_LESSON', title: 'درس جديد', body: 'تم نشر محاضرة جديدة', route: '/lesson/l1' })).toBe(true);
    expect(visible({ kind: 'ANNOUNCEMENT', title: 'A course of 3 credit hours', body: null })).toBe(true);
  });

  it('hides anything that opens a disabled screen', () => {
    expect(visible({ kind: 'ANNOUNCEMENT', title: 'New books', body: 'Open them', route: '/library' })).toBe(false);
    expect(visible({ kind: 'ANNOUNCEMENT', title: 'Balance', body: 'Open it', route: '/wallet' })).toBe(false);
  });

  it('hides payment notifications and sales wording in both languages', () => {
    expect(visible({ kind: 'PAYMENT', title: 'Receipt', body: 'Done' })).toBe(false);
    for (const text of [
      'Only 500 EGP this week',
      'Buy the course now',
      'Ask for your access code',
      'خصم على الكورس',
      'السعر 500 جنيه',
      'اشترك الآن',
      'اطلب كود التفعيل',
      'كارت الشحن متاح',
    ]) {
      expect(isSalesMessaging(text)).toBe(true);
      expect(visible({ kind: 'ANNOUNCEMENT', title: text, body: '' })).toBe(false);
    }
  });

  it('applies the same rule on iOS', () => {
    const item = { kind: 'PAYMENT', title: 'Buy now', route: '/wallet' };
    expect(loadOn('ios').isAnnouncementVisible(item)).toBe(false);
  });
});

describe('EAS Update channel', () => {
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));

  it('gives the Android Play builds their own channel', () => {
    expect(eas.build.production.android.channel).toBe('google-play-production');
    // The APK profile extends production and must not override it.
    expect(eas.build['production:apk'].android.channel).toBeUndefined();
    expect(eas.build['production:apk'].channel).toBeUndefined();
  });

  it('leaves the shared production channel in place for other platforms', () => {
    expect(eas.build.production.channel).toBe('production');
    expect(eas.build.production.ios).toBeUndefined();
  });
});

describe('identity and build configuration', () => {
  const source = readFileSync(join(root, 'app.config.ts'), 'utf8');

  it('keeps the Android package and app name', () => {
    expect(source).toMatch(/production: 'com\.studentcenter\.app'/);
    expect(source).toMatch(/production: 'Student Center'/);
    expect(source).toMatch(/package: BUNDLE_ID\[VARIANT\]/);
  });

  it('keeps the EAS project and the production API', () => {
    expect(source).toContain('f5f88e33-01f3-4049-ae16-6c3cd5221f57');
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    expect(eas.build.production.env.EXPO_PUBLIC_API_URL).toBe(
      'https://student-backend-814y.onrender.com/api/v1'
    );
  });

  it('adds no billing or advertising dependency', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(names).not.toMatch(/admob|google-mobile-ads|facebook-ads|applovin|iap|billing|purchases|revenuecat/i);
  });
});
