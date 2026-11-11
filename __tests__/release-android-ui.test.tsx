/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';

import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { announcementToBanner } from '@/features/ads/api';
import { resolveAdTarget } from '@/features/ads/target';
import { coursePartsApi } from '@/features/course-parts/api';
import { PartsPanel } from '@/features/course-parts/PartsPanel';
import { coursesApi } from '@/features/courses/api';
import { AccessPanel } from '@/features/courses/components/AccessPanel';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { JoinSheet } from '@/features/enrollment/JoinSheet';
import { libraryApi } from '@/features/library/api';
import { walletApi } from '@/features/wallet/api';
import en from '@/i18n/locales/en.json';
import { routeFromNotification } from '@/services/notifications';
import { isSafeInternalRoute } from '@/utils/guards';

import LibraryLayout from '../src/app/library/_layout';
import WalletLayout from '../src/app/wallet/_layout';

/**
 * The Android Google Play build, exercised through the real components, API
 * objects and guards, with the release flags resolved as they are on Android.
 * These run under Jest, not on a device.
 */
jest.mock('@/config/release-features', () => {
  const actual = jest.requireActual('@/config/release-features');
  const features = actual.resolveReleaseFeatures('android', {
    library: false,
    wallet: false,
    courseActivation: false,
    coursePrices: false,
    digitalPurchases: false,
  });
  return {
    ...actual,
    releaseFeatures: features,
    isRouteEnabled: (route: string, f = features) => actual.isRouteEnabled(route, f),
    isAnnouncementVisible: (item: object, f = features) => actual.isAnnouncementVisible(item, f),
  };
});

jest.mock('@/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn(async () => ({})) },
}));

const mockRedirect = jest.fn();
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = () => <Text>stack-rendered</Text>;
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    Stack,
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return <Text>{`redirect:${href}`}</Text>;
    },
  };
});

jest.mock('expo-image', () => ({ Image: () => null }));

// On Android this package assumes Expo Go under Jest and throws on import. Only
// the route check is under test here, and that uses none of its native API.
jest.mock('expo-notifications', () => ({
  AndroidImportance: {},
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
}));

// Animated placeholders need native worklets, which do not exist under Jest.
jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => null,
  CardSkeleton: () => null,
}));
jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => children,
}));

/** Real English strings, so assertions read what a student would read. */
jest.mock('@/hooks/use-translation', () => {
  const bundle = require('@/i18n/locales/en.json');
  const t = (key: string, vars: Record<string, unknown> = {}) => {
    const lookup = (k: string) =>
      k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], bundle);
    const raw = lookup(key) ?? lookup(`${key}_other`) ?? key;
    return String(raw).replace(/\{\{(\w+)\}\}/g, (_, v) => String(vars[v] ?? ''));
  };
  return { useTranslation: () => ({ t, language: 'en', isRTL: false }) };
});

const mockParts = jest.fn();
jest.mock('@/features/course-parts/hooks', () => ({
  useCourseParts: () => mockParts(),
  useCourseJoinOptions: () => ({ isLoading: false, data: undefined }),
}));

jest.mock('@/features/courses/hooks', () => ({
  ...jest.requireActual('@/features/courses/hooks'),
  useRedeemCode: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useEnroll: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const SALES_TEXT = /EGP|E£|ج\.م|\bjoin for\b|\bbuy\b|buying|purchase|checkout|wallet|credit|recharge|access card|access code|redeem/i;

const course = (over: object = {}) =>
  ({
    id: 'c1',
    title: 'Engineering Drawing',
    slug: 'engineering-drawing',
    shortDescription: 'Lessons and revision',
    thumbnailUrl: null,
    teacher: { id: 't1', fullName: 'Eng. Test', avatarUrl: null, title: null, bio: null },
    teachers: [],
    status: 'PUBLISHED',
    price: { amount: 1000, currency: 'EGP' },
    isFree: false,
    lessonCount: 6,
    sectionCount: 2,
    totalDurationSeconds: 6000,
    rating: null,
    studentCount: 6,
    access: { state: 'NOT_ENROLLED', expiresAt: null, enrolledAt: null, availableMethods: ['CODE'] },
    progress: null,
    publishedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  }) as never;

const allText = () => JSON.stringify(screen.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
});

describe('no prices or purchase wording', () => {
  it('the course card shows no price or free label', () => {
    render(<CourseCard course={course()} />);
    expect(screen.getByText('Engineering Drawing')).toBeTruthy();
    expect(allText()).not.toMatch(SALES_TEXT);
    expect(allText()).not.toMatch(/1,?000/);
  });

  it('a free course is not labelled by price either', () => {
    render(<CourseCard course={course({ isFree: true, price: null })} />);
    expect(allText()).not.toContain(en.common.free);
  });

  it('a pending-payment badge reads as pending access', () => {
    render(
      <CourseCard
        course={course({ access: { state: 'PENDING_PAYMENT', expiresAt: null, enrolledAt: null, availableMethods: [] } })}
      />
    );
    expect(screen.getByText(en.release.accessPending)).toBeTruthy();
    expect(allText()).not.toMatch(/payment/i);
  });

  it('course parts show no prices and no way to unlock', () => {
    mockParts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        hasParts: true,
        ownsAllParts: false,
        parts: [
          {
            id: 'p1',
            title: 'Part 1',
            titleAr: null,
            sectionCount: 1,
            price: 600,
            currency: 'EGP',
            owned: false,
            ownedVia: null,
            thumbnailUrl: null,
            sections: [],
          },
        ],
      },
    });
    render(<PartsPanel courseId="c1" onRedeem={jest.fn()} />);
    expect(screen.getByText('Part 1')).toBeTruthy();
    expect(screen.getByText(en.release.partsSubtitle)).toBeTruthy();
    expect(allText()).not.toMatch(SALES_TEXT);
    expect(allText()).not.toContain('600');
  });

  it('already-owned parts still show as owned', () => {
    mockParts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        hasParts: true,
        ownsAllParts: true,
        parts: [
          {
            id: 'p1',
            title: 'Part 1',
            titleAr: null,
            sectionCount: 1,
            price: 600,
            currency: 'EGP',
            owned: true,
            ownedVia: 'PART',
            thumbnailUrl: null,
            sections: [],
          },
        ],
      },
    });
    render(<PartsPanel courseId="c1" onRedeem={jest.fn()} />);
    expect(screen.getByText(en.parts.owned)).toBeTruthy();
  });
});

describe('enrollment counts are hidden from students', () => {
  it('the course card shows no count, even when the API sends one', () => {
    render(<CourseCard course={course({ studentCount: 1234 })} />);
    expect(screen.getByText('Engineering Drawing')).toBeTruthy();
    expect(allText()).not.toMatch(/1,?234|1\.2\s?K/i);
  });

  it.each(['src/features/courses/components/CourseCard.tsx', 'src/app/course/[courseId].tsx'])(
    '%s no longer reads the count or its icon',
    (file) => {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(source).not.toContain('studentCount');
      expect(source).not.toContain('people');
    }
  );

  it.each(['en', 'ar'])('the %s strings have no enrolled-students label', (lang) => {
    const source = readFileSync(join(__dirname, '..', 'src/i18n/locales', `${lang}.json`), 'utf8');
    expect(source).not.toContain('enrolledStudents');
  });
});

describe('course access panel', () => {
  const handlers = () => ({ onJoin: jest.fn(), onContinue: jest.fn(), onContactAdmin: jest.fn() });

  it('a course needing a code shows a neutral notice and nothing to press', () => {
    const h = handlers();
    render(<AccessPanel course={course()} {...h} />);
    expect(screen.getByText(en.release.notActiveTitle)).toBeTruthy();
    expect(allText()).not.toMatch(SALES_TEXT);
    expect(screen.queryByRole('button')).toBeNull();
    expect(h.onJoin).not.toHaveBeenCalled();
  });

  it('existing access still continues the course', () => {
    const h = handlers();
    render(
      <AccessPanel
        course={course({
          access: { state: 'ACTIVE', expiresAt: null, enrolledAt: '2026-10-01', availableMethods: [] },
          progress: { percent: 40 },
        })}
        {...h}
      />
    );
    fireEvent.press(screen.getByText(en.courses.continueCourse));
    expect(h.onContinue).toHaveBeenCalledTimes(1);
    expect(allText()).not.toMatch(SALES_TEXT);
  });

  it('a free course can still be joined, without a price label', () => {
    const h = handlers();
    render(
      <AccessPanel
        course={course({
          isFree: true,
          price: null,
          access: { state: 'NOT_ENROLLED', expiresAt: null, enrolledAt: null, availableMethods: ['FREE'] },
        })}
        {...h}
      />
    );
    fireEvent.press(screen.getByText(en.access.joinNow));
    expect(h.onJoin).toHaveBeenCalledTimes(1);
  });

  it('pending payment offers no action and does not mention payment', () => {
    const h = handlers();
    render(
      <AccessPanel
        course={course({ access: { state: 'PENDING_PAYMENT', expiresAt: null, enrolledAt: null, availableMethods: ['CODE'] } })}
        {...h}
      />
    );
    expect(screen.getByText(en.release.accessPending)).toBeTruthy();
    expect(allText()).not.toMatch(/payment/i);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('an expired course points to support, not to a code', () => {
    const h = handlers();
    render(
      <AccessPanel
        course={course({ access: { state: 'EXPIRED', expiresAt: null, enrolledAt: null, availableMethods: ['CODE'] } })}
        {...h}
      />
    );
    fireEvent.press(screen.getByText(en.settings.contactSupport));
    expect(h.onContactAdmin).toHaveBeenCalledTimes(1);
    expect(h.onJoin).not.toHaveBeenCalled();
  });
});

describe('activation code UI cannot be reached', () => {
  it('the join sheet renders nothing even when asked to be visible', () => {
    render(<JoinSheet courseId="c1" visible onClose={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('the course screen mounts the sheet only behind the flag', () => {
    const source = readFileSync(join(__dirname, '..', 'src/app/course/[courseId].tsx'), 'utf8');
    expect(source).toMatch(/releaseFeatures\.courseActivation \? \(\s*<JoinSheet/);
    expect(source).toMatch(/if \(releaseFeatures\.courseActivation\) setEnrollOpen\(true\)/);
  });
});

describe('disabled screens cannot be opened', () => {
  it('the Library route layout redirects to Home', () => {
    render(<LibraryLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(screen.queryByText('stack-rendered')).toBeNull();
  });

  it('the wallet route layout redirects to Home', () => {
    render(<WalletLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(screen.queryByText('stack-rendered')).toBeNull();
  });

  it('every Library and wallet screen sits under a guarded layout', () => {
    const app = join(__dirname, '..', 'src/app');
    for (const layout of ['library/_layout.tsx', 'wallet/_layout.tsx']) {
      expect(readFileSync(join(app, layout), 'utf8')).toMatch(/return <Redirect href="\/\(tabs\)" \/>/);
    }
  });

  it.each(['/library', '/library/m1', '/library/reader/p1', '/wallet'])(
    'network-supplied route %s is refused',
    (route) => {
      expect(isSafeInternalRoute(route)).toBe(false);
    }
  );

  it.each(['/course/c1', '/lesson/l1', '/player/v1', '/viewer/a1', '/notifications', '/support'])(
    'core route %s still opens',
    (route) => {
      expect(isSafeInternalRoute(route)).toBe(true);
    }
  );

  it('a push notification into the wallet opens nothing', () => {
    const response = (route: string) =>
      ({ notification: { request: { content: { data: { route } } } } }) as never;
    expect(routeFromNotification(response('/wallet'))).toBeNull();
    expect(routeFromNotification(response('/library/m1'))).toBeNull();
    expect(routeFromNotification(response('/lesson/l1'))).toBe('/lesson/l1');
  });

  it('Home and Settings links to these screens are behind the flags', () => {
    const app = join(__dirname, '..', 'src/app');
    const home = readFileSync(join(app, '(tabs)/index.tsx'), 'utf8');
    const settings = readFileSync(join(app, 'settings/index.tsx'), 'utf8');
    expect(home).toMatch(/releaseFeatures\.library \? \([\s\S]{0,120}router\.push\('\/library'\)/);
    expect(settings).toMatch(/releaseFeatures\.library && releaseFeatures\.wallet \? \([\s\S]{0,320}router\.push\('\/library'\)/);
  });
});

describe('no purchase or redemption request can leave the app', () => {
  const refused = [
    ['course code redemption', () => coursesApi.redeemCode('c1', 'CODE')],
    ['enrol by payment', () => coursesApi.enroll('c1', 'PAYMENT')],
    ['enrol by code', () => coursesApi.enroll('c1', 'CODE')],
    ['code validation', () => coursePartsApi.validateCode('CODE', 'c1')],
    ['wallet recharge', () => walletApi.redeem('CODE')],
    ['library quote', () => libraryApi.quote('PART', 'p1')],
    ['library purchase', () => libraryApi.purchase('PART', 'p1')],
    ['library reader', () => libraryApi.open('p1')],
  ] as const;

  it.each(refused)('%s is refused before any request', async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(ApiError);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('free enrolment still reaches the server', async () => {
    await coursesApi.enroll('c1', 'FREE');
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe('errors do not instruct a student to join or pay', () => {
  it.each(['NOT_ENROLLED', 'PAYMENT_REQUIRED'] as const)('%s reads as not active', (code) => {
    expect(new ApiError({ code, status: 403, message: 'x' }).i18nKey).toBe('release.notActiveBody');
  });

  it('other errors keep their own message', () => {
    expect(new ApiError({ code: 'SERVER_ERROR', status: 500, message: 'x' }).i18nKey).toBe('errors.SERVER_ERROR');
  });
});

describe('Home banners', () => {
  const announcement = (over: object = {}) =>
    ({
      id: 'n1',
      kind: 'ANNOUNCEMENT',
      title: 'Mid-term timetable',
      body: 'Published for every year.',
      read: false,
      createdAt: '2026-09-01T10:00:00.000Z',
      route: null,
      imageUrl: 'https://cdn.example.test/banner.png',
      ...over,
    }) as never;

  it('keeps a neutral announcement', () => {
    expect(announcementToBanner(announcement(), 0)).not.toBeNull();
  });

  it('drops sales messages and banners into disabled screens', () => {
    expect(announcementToBanner(announcement({ title: 'Buy now for 500 EGP' }), 0)).toBeNull();
    expect(announcementToBanner(announcement({ route: '/library' }), 0)).toBeNull();
    expect(announcementToBanner(announcement({ route: '/wallet' }), 0)).toBeNull();
  });

  it('keeps banner targets on allowed routes and off outside pages', () => {
    const base = { entityId: null };
    expect(resolveAdTarget({ ...base, type: 'APP_SCREEN', url: '/wallet' })).toBeNull();
    expect(resolveAdTarget({ ...base, type: 'APP_SCREEN', url: '/library/m1' })).toBeNull();
    expect(resolveAdTarget({ ...base, type: 'EXTERNAL_URL', url: 'https://example.test/pay' })).toBeNull();
    expect(resolveAdTarget({ ...base, type: 'APP_SCREEN', url: '/notifications' })).toEqual({
      kind: 'internal',
      href: '/notifications',
    });
  });
});

describe('strings', () => {
  it('the new wording contains no purchase, code or wallet language', () => {
    expect(JSON.stringify(en.release)).not.toMatch(SALES_TEXT);
  });

  it('account deletion stays reachable and keeps its balance warning', () => {
    const source = readFileSync(join(__dirname, '..', 'src/app/settings/delete-account.tsx'), 'utf8');
    expect(source).toMatch(/useWallet\(\)/);
    expect(source).toMatch(/deleteAccount\.confirmBalance/);
    // Deletion never waits on a failed wallet lookup (App Store 5.1.1(v)).
    expect(source).toMatch(/disabled=\{busy \|\| wallet\.isPending\}/);
    expect(source).toMatch(/releaseFeatures\.wallet \|\| hasBalance \? \(/);
  });
});
