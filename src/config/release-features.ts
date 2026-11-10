import { env } from './env';

/**
 * What the Student Center mobile apps may do.
 *
 * Owner decision (2026-11-10): the mobile apps, on EVERY platform, are
 * content-consumption only. A student signs in and uses what is already on
 * their account; courses are activated through the website or by the
 * administration, and the app recognises the entitlement on its next refresh.
 * Nothing in the app sells, prices, spends credit, enters a code, or points at
 * a place to pay. The commercial code paths stay in the tree for the web and
 * admin clients' sake, but they are unreachable here: the four commercial
 * flags are constants, not configuration, and no platform is exempt.
 *
 * `library` is the one feature that remains a release switch: it is content
 * (reading authorized materials), so it is on in the store profiles and
 * controlled by EXPO_PUBLIC_ENABLE_LIBRARY only to hold a release back if the
 * reader needs work on a platform. Even with the library on, its purchase
 * surfaces follow the commercial flags below and are therefore never shown.
 *
 * Do not turn any of these on with an EAS Update. That changes what a reviewed
 * store release does without review.
 */
export interface ReleaseFeatures {
  /** ENABLE_LIBRARY: browsing, previews and the reader for materials on the account. */
  library: boolean;
  /** Balance, transactions, recharge cards. Always off in the mobile apps. */
  wallet: boolean;
  /** Entering a code to unlock a course or part. Always off in the mobile apps. */
  courseActivation: boolean;
  /** Course, part, package and material prices. Always off in the mobile apps. */
  coursePrices: boolean;
  /** Any purchase flow, label or outside payment link. Always off in the mobile apps. */
  digitalPurchases: boolean;
}

/** The commercial surfaces the mobile apps never expose, whatever the variables say. */
export const CONSUMPTION_ONLY = Object.freeze({
  wallet: false,
  courseActivation: false,
  coursePrices: false,
  digitalPurchases: false,
} as const);

/**
 * `platform` is accepted for call-site compatibility and deliberately ignored:
 * iOS and Android (and web previews) resolve the same way.
 */
export function resolveReleaseFeatures(
  _platform: string,
  flags: Pick<ReleaseFeatures, 'library'>
): ReleaseFeatures {
  return {
    library: flags.library,
    ...CONSUMPTION_ONLY,
  };
}

export const releaseFeatures = resolveReleaseFeatures('any', env.features);

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
