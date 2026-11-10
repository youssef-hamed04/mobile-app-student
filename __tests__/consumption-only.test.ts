/* eslint-disable @typescript-eslint/no-require-imports -- isolateModules needs a fresh require */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CONSUMPTION_ONLY,
  isAnnouncementVisible,
  isRouteEnabled,
  releaseFeatures,
  resolveReleaseFeatures,
  type ReleaseFeatures,
} from '@/config/release-features';

import ar from '../src/i18n/locales/ar.json';
import en from '../src/i18n/locales/en.json';

/**
 * Owner decision (2026-11-10): the Student Center mobile apps are content
 * consumption only, on every platform. Courses are activated on the website or
 * by the administration; the app shows no price, sells nothing, redeems no
 * code and points nowhere to pay. These tests pin that for iOS and Android
 * alike, independently of the EXPO_PUBLIC_* variables, under both Jest presets.
 */
const root = join(__dirname, '..');
const src = (rel: string) => readFileSync(join(root, 'src', rel), 'utf8');

const ON: ReleaseFeatures = {
  library: true,
  wallet: true,
  courseActivation: true,
  coursePrices: true,
  digitalPurchases: true,
};

const SALES_TEXT =
  /EGP|E£|ج\.م|جنيه|join for|buy|buying|purchase|checkout|wallet|recharge|access card|access code|redeem|activation code|كود التفعيل|شراء|اشترك الآن|ادفع/i;

describe('the commercial flags are constants, not configuration', () => {
  it('resolve to false on every platform even when every variable is on', () => {
    for (const platform of ['ios', 'android', 'web', 'macos', '']) {
      const f = resolveReleaseFeatures(platform, ON);
      expect(f.wallet).toBe(false);
      expect(f.courseActivation).toBe(false);
      expect(f.coursePrices).toBe(false);
      expect(f.digitalPurchases).toBe(false);
      expect(f.library).toBe(true);
    }
    expect(CONSUMPTION_ONLY).toEqual({
      wallet: false,
      courseActivation: false,
      coursePrices: false,
      digitalPurchases: false,
    });
  });

  it('hold for the real module under this preset and under the other platform', () => {
    for (const flags of [releaseFeatures, loadOn('ios'), loadOn('android')]) {
      expect(flags.wallet).toBe(false);
      expect(flags.courseActivation).toBe(false);
      expect(flags.coursePrices).toBe(false);
      expect(flags.digitalPurchases).toBe(false);
    }
  });

  it('never let the wallet route open, on any platform', () => {
    for (const route of ['/wallet', '/wallet/', 'eduplatform://wallet', '/WALLET?x=1']) {
      expect(isRouteEnabled(route, resolveReleaseFeatures('ios', ON))).toBe(false);
      expect(isRouteEnabled(route, resolveReleaseFeatures('android', ON))).toBe(false);
    }
  });

  it('hide sales announcements on every platform', () => {
    const f = resolveReleaseFeatures('ios', ON);
    expect(isAnnouncementVisible({ kind: 'PAYMENT', title: 'Receipt' }, f)).toBe(false);
    expect(isAnnouncementVisible({ kind: 'ANNOUNCEMENT', title: 'Buy the course now' }, f)).toBe(false);
    expect(isAnnouncementVisible({ kind: 'ANNOUNCEMENT', title: 'اطلب كود التفعيل' }, f)).toBe(false);
    expect(isAnnouncementVisible({ kind: 'NEW_LESSON', title: 'New lecture', route: '/lesson/l1' }, f)).toBe(true);
  });
});

describe('the store build profile', () => {
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));

  it('ships the library (content) and keeps every commercial variable false for both platforms', () => {
    const env = eas.build.production.env;
    expect(env.EXPO_PUBLIC_ENABLE_LIBRARY).toBe('true');
    expect(env.EXPO_PUBLIC_ENABLE_WALLET).toBe('false');
    expect(env.EXPO_PUBLIC_ENABLE_COURSE_ACTIVATION).toBe('false');
    expect(env.EXPO_PUBLIC_SHOW_COURSE_PRICES).toBe('false');
    expect(env.EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES).toBe('false');
    // One profile for both stores: nothing iOS-specific re-enables anything.
    expect(eas.build.production.ios).toBeUndefined();
  });
});

describe('no activation, purchase or payment request can be sent', () => {
  // The guards run before any transport call, so a mocked client proves nothing
  // left the app. Mirrors release-android-ui.test.tsx but under the default
  // (non-Android) preset, which is the iOS case.
  it('rejects every commercial call with an ApiError', async () => {
    const post = jest.fn();
    let mods!: {
      ApiError: new (...args: never[]) => Error;
      coursesApi: { redeemCode: (...a: never[]) => Promise<unknown>; enroll: (...a: never[]) => Promise<unknown> };
      coursePartsApi: { validateCode: (...a: never[]) => Promise<unknown> };
      walletApi: { redeem: (...a: never[]) => Promise<unknown> };
      libraryApi: { quote: (...a: never[]) => Promise<unknown>; purchase: (...a: never[]) => Promise<unknown> };
    };
    jest.isolateModules(() => {
      jest.doMock('@/api/client', () => ({ api: { post, get: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
      mods = {
        ApiError: require('@/api/errors').ApiError,
        coursesApi: require('@/features/courses/api').coursesApi,
        coursePartsApi: require('@/features/course-parts/api').coursePartsApi,
        walletApi: require('@/features/wallet/api').walletApi,
        libraryApi: require('@/features/library/api').libraryApi,
      };
    });
    const calls: (() => Promise<unknown>)[] = [
      () => mods.coursesApi.redeemCode(...(['c1', 'ABCD-1234'] as never[])),
      () => mods.coursesApi.enroll(...(['c1', 'CODE', { code: 'ABCD-1234' }] as never[])),
      () => mods.coursesApi.enroll(...(['c1', 'PAYMENT'] as never[])),
      () => mods.coursePartsApi.validateCode(...(['ABCD-1234'] as never[])),
      () => mods.walletApi.redeem(...(['ABCD-1234'] as never[])),
      () => mods.libraryApi.quote(...(['PART', 'p1'] as never[])),
      () => mods.libraryApi.purchase(...(['PART', 'p1'] as never[])),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toBeInstanceOf(mods.ApiError);
    }
    expect(post).not.toHaveBeenCalled();
  });
});

describe('screens derive access from the account and never sell', () => {
  it('course screen mounts no join sheet and opens none on a locked lesson', () => {
    const course = src('app/course/[courseId].tsx');
    expect(course).toMatch(/releaseFeatures\.courseActivation \? \(\s*<JoinSheet/);
    expect(course).toMatch(/if \(releaseFeatures\.courseActivation\) setEnrollOpen\(true\)/);
  });

  it('course cards, access panel, parts panel and lesson rows gate every price and label on the flags', () => {
    for (const rel of [
      'features/courses/components/CourseCard.tsx',
      'features/courses/components/AccessPanel.tsx',
      'features/course-parts/PartsPanel.tsx',
      'features/courses/components/LessonRow.tsx',
    ]) {
      const text = src(rel);
      expect(text).toMatch(/releaseFeatures\.(coursePrices|digitalPurchases|courseActivation)/);
      // Every money format is behind a flag read in the same file.
      if (/formatMoney\(/.test(text)) expect(text).toMatch(/releaseFeatures\.coursePrices/);
    }
  });

  it('library screens show materials and the reader, but no price, package, buy button or wallet link', () => {
    const index = src('app/library/index.tsx');
    expect(index).toMatch(/releaseFeatures\.wallet \? \(/);
    expect(index).toMatch(/useWallet\(\{ enabled: releaseFeatures\.wallet \}\)/);
    expect(index).toMatch(/releaseFeatures\.coursePrices && material\.priceFrom !== null/);
    const material = src('app/library/[materialId].tsx');
    expect(material).toMatch(/releaseFeatures\.digitalPurchases && material\.packages\.length > 0/);
    expect(material).toMatch(/releaseFeatures\.coursePrices \? \(/);
    expect(material).toMatch(/!releaseFeatures\.digitalPurchases \? null : part\.purchasable/);
    expect(material).toMatch(/t\('release\.libraryLocked'\)/);
    expect(material).toMatch(/useWallet\(\{ enabled: releaseFeatures\.wallet \}\)/);
    // Reading stays: owned and preview parts keep their Read button and route.
    expect(material).toMatch(/part\.owned \|\| part\.isPreview \? \(/);
    expect(material).toMatch(/router\.push\(`\/library\/reader\/\$\{part\.id\}`\)/);
    // The library layout redirects only when the library switch is off.
    expect(src('app/library/_layout.tsx')).toMatch(/if \(!releaseFeatures\.library\) return <Redirect/);
    expect(src('app/wallet/_layout.tsx')).toMatch(/if \(!releaseFeatures\.wallet\) return <Redirect/);
  });

  it('banners open no outside page and notifications open no disabled screen', () => {
    expect(src('features/ads/target.ts')).toMatch(/releaseFeatures\.digitalPurchases/);
    expect(src('utils/guards.ts')).toMatch(/isRouteEnabled/);
  });
});

describe('entitlements granted elsewhere are picked up on the next refresh', () => {
  it('course data is refetched on focus and is stale within minutes', () => {
    const client = src('api/query-client.ts');
    expect(client).toMatch(/refetchOnWindowFocus: true/);
    expect(client).toMatch(/refetchOnReconnect: true/);
    expect(client).toMatch(/focusManager\.setFocused\(status === 'active'\)/);
    const hooks = src('features/courses/hooks.ts');
    const stale = [...hooks.matchAll(/staleTime: ([^,\n]+)/g)].map((m) => m[1] ?? '');
    expect(stale.length).toBeGreaterThan(0);
    for (const value of stale) {
      // eslint-disable-next-line no-eval -- arithmetic literals from the source
      expect(Number(eval(value))).toBeLessThanOrEqual(5 * 60_000);
    }
  });

  it('a free enrolment and an existing entitlement keep working', () => {
    const api = src('features/courses/api.ts');
    // FREE and ADMIN_APPROVAL are not purchases and stay callable.
    expect(api).toMatch(/method === 'PAYMENT'/);
    expect(api).toMatch(/method === 'CODE'/);
    const panel = src('features/courses/components/AccessPanel.tsx');
    // An entitled student is sent into the course; a non-entitled one sees the neutral lock.
    expect(panel).toMatch(/t\('courses\.continueCourse'\)/);
    expect(panel).toMatch(/release\.notActiveTitle/);
  });
});

describe('free previews and library reading remain', () => {
  it('preview lessons carry the neutral preview badge and play', () => {
    const row = src('features/courses/components/LessonRow.tsx');
    expect(row).toMatch(/lesson\.isPreview \? \(/);
    expect(row).toMatch(/t\('release\.preview'\)/);
  });

  it('the library reader is reachable for owned and preview parts', () => {
    expect(src('features/library/api.ts')).toMatch(/assertFeatureEnabled\(releaseFeatures\.library, 'library'\)/);
  });
});

describe('Arabic and English follow the same rules', () => {
  it('the neutral strings exist in both languages and carry no sales wording', () => {
    for (const dict of [en, ar]) {
      const release = (dict as { release: Record<string, string> }).release;
      for (const key of ['notActiveTitle', 'notActiveBody', 'lockedBody', 'accessPending', 'preview', 'libraryLocked']) {
        expect(typeof release[key]).toBe('string');
        expect(release[key]).not.toMatch(SALES_TEXT);
      }
    }
    expect(Object.keys(ar.release).sort()).toEqual(Object.keys(en.release).sort());
  });
});

/** Loads the real module with the platform set, so this holds under either Jest preset. */
function loadOn(platform: 'ios' | 'android'): ReleaseFeatures {
  let loaded!: ReleaseFeatures;
  jest.isolateModules(() => {
    const { Platform } = require('react-native');
    Platform.OS = platform;
    loaded = require('@/config/release-features').releaseFeatures;
  });
  return loaded;
}
