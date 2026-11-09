import { Platform } from 'react-native';

import { env } from './env';

/**
 * What the Google Play first release of this app may do.
 *
 * The first Android release is consumption-only: a student signs in and uses
 * what is already on their account. Selling, spending credit and entering codes
 * stay implemented, and stay available on every other platform, but cannot be
 * reached from this build.
 *
 * The values come from `env.features` (EXPO_PUBLIC_* variables), and apply on
 * Android only. iOS always gets everything, whatever the variables say.
 *
 * Do not turn any of these on with an EAS Update. That changes what a reviewed
 * Play release does without review. Enable them in a new reviewed release.
 */
export interface ReleaseFeatures {
  /** ENABLE_LIBRARY: browsing, previews, purchases, the reader, My Library. */
  library: boolean;
  /** ENABLE_WALLET: balance, transactions, recharge cards. */
  wallet: boolean;
  /** ENABLE_COURSE_ACTIVATION: entering a code to unlock a course or part. */
  courseActivation: boolean;
  /** SHOW_COURSE_PRICES: course and part prices and the labels built on them. */
  coursePrices: boolean;
  /** ENABLE_DIGITAL_PURCHASES: any purchase flow, label or outside payment link. */
  digitalPurchases: boolean;
}

const ALL_ENABLED: ReleaseFeatures = {
  library: true,
  wallet: true,
  courseActivation: true,
  coursePrices: true,
  digitalPurchases: true,
};

export function resolveReleaseFeatures(
  platform: string,
  flags: ReleaseFeatures
): ReleaseFeatures {
  if (platform !== 'android') return ALL_ENABLED;
  return {
    library: flags.library,
    wallet: flags.wallet,
    courseActivation: flags.courseActivation,
    coursePrices: flags.coursePrices,
    digitalPurchases: flags.digitalPurchases,
  };
}

export const releaseFeatures = resolveReleaseFeatures(Platform.OS, env.features);

/**
 * The first path segment of a route, however it arrived: `/wallet/`,
 * `eduplatform://wallet`, `/(group)/library/x?y=1`.
 */
function firstSegment(route: string): string {
  const withoutScheme = route.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const path = withoutScheme.split(/[?#]/)[0] ?? '';
  const segments = path.split('/').filter((s) => s.length > 0 && !/^\(.*\)$/.test(s));
  return (segments[0] ?? '').toLowerCase();
}

/**
 * The shared answer to "may this route open in this release?".
 *
 * `utils/guards.ts` uses it for network-supplied routes and the banner targets
 * use it for theirs. The `library` and `wallet` route layouts enforce the same
 * flags, so a route that bypasses this function still lands on Home.
 */
export function isRouteEnabled(
  route: string,
  features: ReleaseFeatures = releaseFeatures
): boolean {
  const segment = firstSegment(route);
  if (segment === 'library') return features.library;
  if (segment === 'wallet') return features.wallet;
  return true;
}

/**
 * Sales wording in admin-written announcements, in English and Arabic.
 *
 * Deliberately specific. Bare "credit" is left out because of credit hours, and
 * bare "code" and "كود" because of programming courses.
 */
const SALES_WORDING = new RegExp(
  [
    '\\b(prices?|egp|buy|buying|purchases?|discounts?|checkout|payments?|pay|recharge|top[ -]?up|wallet)\\b',
    '\\b(access|activation|course) (code|card)s?\\b',
    'سعر|أسعار|جنيه|ج\\.م|اشتر|شراء|خصم|محفظ|رصيد|شحن|ادفع|دفع|كارت|كروت',
    'كود (التفعيل|تفعيل|الوصول|وصول|الكورس|الاشتراك)',
  ].join('|'),
  'i'
);

export function isSalesMessaging(text: string | null | undefined): boolean {
  return !!text && SALES_WORDING.test(text);
}

/**
 * Whether an announcement or notification may be shown in this release.
 *
 * Hides anything that promotes a purchase or opens a disabled screen. Purely a
 * display decision: nothing on the server changes, and other clients still get
 * the same item.
 */
export function isAnnouncementVisible(
  item: {
    kind?: string | null;
    title?: string | null;
    body?: string | null;
    route?: string | null;
  },
  features: ReleaseFeatures = releaseFeatures
): boolean {
  if (item.route && !isRouteEnabled(item.route, features)) return false;
  if (features.digitalPurchases && features.coursePrices) return true;
  if (item.kind === 'PAYMENT') return false;
  return !isSalesMessaging(item.title) && !isSalesMessaging(item.body);
}
