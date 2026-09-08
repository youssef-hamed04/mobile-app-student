import type { AxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { createLogger } from '@/services/logger';
import type { Paginated, RequestOptions } from '@/types/api';
import type {
  AccessState,
  Advertisement,
  AttachmentTicket,
  AuthorizedDevice,
  ContinueWatchingItem,
  CourseDetail,
  CourseSummary,
  EnrollmentResult,
  HomeFeed,
  LessonDetail,
  PlaybackTicket,
  SearchResultGroup,
  User,
  WatchProgress,
} from '@/types/domain';

import { ApiError } from '../errors';

import {
  academicYears,
  accessCodes,
  advertisements,
  courses,
  currentUser,
  departments,
  faculties,
  lessonIndex,
  notifications,
  progressStore,
  teachers,
  universities,
  usedCodes,
} from './data';

const log = createLogger('mock-api');

/**
 * In-memory mock backend.
 *
 * This exists so the app is runnable and demoable before the NestJS service
 * is written. It is:
 *   - wired in at the transport boundary only (`request()` in client.ts), so
 *     no feature code knows it exists;
 *   - disabled outright in production builds (see `useMocks` in config/env);
 *   - deliberately faithful about *failure*: it returns the same ApiError
 *     codes the real backend will, including device and playback denials, so
 *     the error UI is exercised rather than assumed.
 *
 * Delete this folder once the real API is live — nothing imports from it.
 */

const LATENCY_MS = 350;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let mockUser: User = { ...currentUser };
let loggedIn = false;
const enrollments = new Map<string, AccessState>(
  courses.map((c) => [c.id, c.access.state])
);

function fail(code: ApiError['code'], status = 400, message = 'Mock failure'): never {
  throw new ApiError({ code, status, message });
}

function requireAuth() {
  if (!loggedIn) fail('UNAUTHORIZED', 401, 'Not authenticated');
}

function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: { page, pageSize, total, totalPages, hasNext: page < totalPages },
  };
}

function withAccess(course: CourseDetail): CourseDetail {
  const state = enrollments.get(course.id) ?? course.access.state;
  const hasAccess = state === 'ACTIVE';

  return {
    ...course,
    access: { ...course.access, state },
    sections: course.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => ({
        ...l,
        locked: !hasAccess && !l.isPreview,
        progress: progressStore.get(l.id) ?? null,
      })),
      progressPercent: sectionProgress(s.lessons.map((l) => l.id)),
    })),
    progress: courseProgress(course),
  };
}

function sectionProgress(lessonIds: string[]): number {
  if (lessonIds.length === 0) return 0;
  const done = lessonIds.filter((id) => progressStore.get(id)?.completed).length;
  return Math.round((done / lessonIds.length) * 100);
}

function courseProgress(course: CourseDetail) {
  const ids = course.sections.flatMap((s) => s.lessons.map((l) => l.id));
  const done = ids.filter((id) => progressStore.get(id)?.completed);
  const last = [...progressStore.values()]
    .filter((p) => ids.includes(p.lessonId))
    .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))[0];

  if (done.length === 0 && !last) return null;

  return {
    completedLessons: done.length,
    totalLessons: ids.length,
    percent: ids.length ? Math.round((done.length / ids.length) * 100) : 0,
    lastLessonId: last?.lessonId ?? null,
    lastWatchedAt: last?.lastWatchedAt ?? null,
  };
}

function toSummary(course: CourseDetail): CourseSummary {
  const { sections: _s, attachments: _a, description: _d, ...rest } = course;
  return rest;
}

function findCourse(id: string): CourseDetail {
  const c = courses.find((x) => x.id === id);
  if (!c) fail('NOT_FOUND', 404, 'Course not found');
  return withAccess(c);
}

function courseOfLesson(lessonId: string): CourseDetail {
  const lesson = lessonIndex.get(lessonId);
  if (!lesson) fail('NOT_FOUND', 404, 'Lesson not found');
  return findCourse(lesson.courseId);
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

type Handler = (ctx: {
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
}) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:([A-Za-z]+)/g, (_m, key: string) => {
        keys.push(key);
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method: method.toUpperCase(), pattern, keys, handler });
}

// ---- auth -----------------------------------------------------------------

route('POST', '/auth/login', ({ body }) => {
  const phone = String(body.phone ?? '');
  const password = String(body.password ?? '');

  if (phone === '01000000000') fail('ACCOUNT_DISABLED', 403, 'Disabled account');
  if (phone === '01011111111') fail('DEVICE_NOT_AUTHORIZED', 403, 'Other device');
  if (password.length < 8) fail('INVALID_CREDENTIALS', 401, 'Bad credentials');

  loggedIn = true;
  mockUser = { ...currentUser, phone };

  return {
    user: mockUser,
    accessToken: fakeJwt(900),
    refreshToken: 'mock-refresh-token',
    expiresIn: 900,
  };
});

route('POST', '/auth/register', ({ body }) => {
  const phone = String(body.phone ?? '');
  if (phone === '01099999999') {
    fail('PHONE_ALREADY_REGISTERED', 409, 'Phone taken');
  }

  loggedIn = true;
  mockUser = {
    ...currentUser,
    id: '99001',
    fullName: String(body.fullName ?? 'New Student'),
    phone,
    gender: (body.gender as User['gender']) ?? 'MALE',
    university:
      universities.find((u) => u.id === body.universityId) ?? universities[0]!,
    faculty: faculties.find((f) => f.id === body.facultyId) ?? faculties[0]!,
    department:
      departments.find((d) => d.id === body.departmentId) ?? departments[0]!,
    academicYear:
      academicYears.find((y) => y.id === body.academicYearId) ?? academicYears[0]!,
    createdAt: new Date().toISOString(),
  };

  return {
    user: mockUser,
    accessToken: fakeJwt(900),
    refreshToken: 'mock-refresh-token',
    expiresIn: 900,
  };
});

route('POST', '/auth/refresh', () => ({
  accessToken: fakeJwt(900),
  refreshToken: 'mock-refresh-token',
  expiresIn: 900,
}));

route('POST', '/auth/logout', () => {
  loggedIn = false;
  return { ok: true };
});

route('GET', '/auth/me', () => {
  requireAuth();
  return mockUser;
});

// ---- catalog --------------------------------------------------------------

route('GET', '/catalog/universities', () => universities);
route('GET', '/catalog/universities/:id/faculties', ({ params }) =>
  faculties.filter((f) => f.universityId === params.id)
);
route('GET', '/catalog/faculties/:id/departments', ({ params }) =>
  departments.filter((d) => d.facultyId === params.id)
);
route('GET', '/catalog/academic-years', () => academicYears);

// ---- home -----------------------------------------------------------------

route('GET', '/home/feed', (): HomeFeed => {
  requireAuth();
  const all = courses.map(withAccess);
  const mine = all.filter((c) => enrollments.get(c.id) === 'ACTIVE');

  return {
    continueWatching: continueWatching(),
    myCourses: mine.map(toSummary),
    newCourses: all
      .filter((c) => c.status === 'PUBLISHED')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, 5)
      .map(toSummary),
    recommended: all
      .filter((c) => enrollments.get(c.id) === 'NOT_ENROLLED')
      .map(toSummary),
    announcements: notifications.filter((n) => n.kind === 'ANNOUNCEMENT'),
    stats: {
      enrolledCourses: mine.length,
      completedLessons: [...progressStore.values()].filter((p) => p.completed).length,
      watchTimeSeconds: [...progressStore.values()].reduce(
        (a, p) => a + p.positionSeconds,
        0
      ),
      streakDays: 4,
    },
  };
});

function continueWatching(): ContinueWatchingItem[] {
  return [...progressStore.values()]
    .filter((p) => !p.completed && p.percent > 0)
    .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
    .slice(0, 6)
    .flatMap((progress) => {
      const lesson = lessonIndex.get(progress.lessonId);
      if (!lesson) return [];
      const course = courses.find((c) => c.id === lesson.courseId);
      if (!course) return [];
      return [
        {
          lesson: { ...lesson, progress },
          course: {
            id: course.id,
            title: course.title,
            thumbnailUrl: course.thumbnailUrl,
            teacher: course.teacher,
          },
          progress,
        },
      ];
    });
}

// ---- ads ------------------------------------------------------------------

/**
 * Mirrors the shape the real endpoint will serve: already filtered to active,
 * in-window promotions for this student and ordered by displayOrder, so the
 * app never has to do audience or scheduling logic of its own.
 */
route('GET', '/ads', (): Advertisement[] => {
  requireAuth();
  const now = Date.now();
  return advertisements
    .filter((ad) => !ad.startsAt || Date.parse(ad.startsAt) <= now)
    .filter((ad) => !ad.endsAt || Date.parse(ad.endsAt) >= now)
    .sort((a, b) => a.displayOrder - b.displayOrder);
});

// ---- courses --------------------------------------------------------------

route('GET', '/courses', ({ query }) => {
  const page = Number(query.page ?? 1);
  const q = (query.q ?? '').toLowerCase();
  const free = query.free === 'true';
  const universityId = query.universityId;
  const academicYearId = query.academicYearId;

  let list = courses.map(withAccess).filter((c) => c.status !== 'DRAFT');

  if (q) {
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.teacher.fullName.toLowerCase().includes(q)
    );
  }
  if (free) list = list.filter((c) => c.isFree);
  if (universityId) list = list.filter((c) => c.university?.id === universityId);
  if (academicYearId) list = list.filter((c) => c.academicYear?.id === academicYearId);

  const sort = query.sort ?? 'newest';
  if (sort === 'popular') {
    list.sort((a, b) => (b.studentCount ?? 0) - (a.studentCount ?? 0));
  } else if (sort === 'priceLow') {
    list.sort((a, b) => (a.price?.amount ?? 0) - (b.price?.amount ?? 0));
  } else if (sort === 'priceHigh') {
    list.sort((a, b) => (b.price?.amount ?? 0) - (a.price?.amount ?? 0));
  } else {
    list.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  }

  return paginate(list.map(toSummary), page, Number(query.pageSize ?? 20));
});

route('GET', '/courses/mine', ({ query }) => {
  requireAuth();
  const list = courses
    .map(withAccess)
    .filter((c) => {
      const state = enrollments.get(c.id);
      return state === 'ACTIVE' || state === 'EXPIRED' || state === 'ARCHIVED';
    })
    .map(toSummary);
  return paginate(list, Number(query.page ?? 1));
});

route('GET', '/courses/:id', ({ params }) => findCourse(params.id!));

route('GET', '/courses/:id/sections', ({ params }) => findCourse(params.id!).sections);

route('POST', '/courses/:id/enroll', ({ params, body }): EnrollmentResult => {
  requireAuth();
  const course = findCourse(params.id!);
  const method = String(body.method ?? '');

  if (course.status === 'ARCHIVED') fail('COURSE_ARCHIVED', 410, 'Archived');

  if (method === 'FREE') {
    if (!course.isFree) fail('PAYMENT_REQUIRED', 402, 'Not a free course');
    enrollments.set(course.id, 'ACTIVE');
    return { state: 'ACTIVE', courseId: course.id, payment: null };
  }

  if (method === 'ADMIN_APPROVAL') {
    enrollments.set(course.id, 'PENDING_APPROVAL');
    return { state: 'PENDING_APPROVAL', courseId: course.id, payment: null };
  }

  if (method === 'PAYMENT') {
    enrollments.set(course.id, 'PENDING_PAYMENT');
    return {
      state: 'PENDING_PAYMENT',
      courseId: course.id,
      payment: {
        provider: 'mock',
        checkoutUrl: 'https://example.com/mock-checkout',
        reference: `PAY-${course.id}-${Date.now()}`,
      },
    };
  }

  fail('VALIDATION_ERROR', 400, 'Unknown enrollment method');
});

route('POST', '/courses/:id/redeem', ({ params, body }): EnrollmentResult => {
  requireAuth();
  const course = findCourse(params.id!);
  const code = String(body.code ?? '').trim().toUpperCase();

  if (usedCodes.has(code)) fail('CODE_ALREADY_USED', 409, 'Code used');
  if (!(accessCodes[course.id] ?? []).includes(code)) {
    fail('INVALID_CODE', 400, 'Invalid code');
  }

  usedCodes.add(code);
  enrollments.set(course.id, 'ACTIVE');
  return { state: 'ACTIVE', courseId: course.id, payment: null };
});

// ---- lessons --------------------------------------------------------------

route('GET', '/lessons/:id', ({ params }): LessonDetail => {
  requireAuth();
  const lesson = lessonIndex.get(params.id!);
  if (!lesson) fail('NOT_FOUND', 404, 'Lesson not found');

  const course = courseOfLesson(lesson.id);
  const state = enrollments.get(course.id);

  if (state === 'ARCHIVED') fail('COURSE_ARCHIVED', 410, 'Archived');
  if (state === 'EXPIRED') fail('ACCESS_EXPIRED', 410, 'Expired');
  if (state !== 'ACTIVE' && !lesson.isPreview) fail('NOT_ENROLLED', 403, 'Locked');

  return { ...lesson, progress: progressStore.get(lesson.id) ?? null };
});

/**
 * Mirrors the real backend's `GET /lessons/by-video/:videoId`.
 *
 * The mock mints video ids as `v-<lessonId>`, which is fine as an internal
 * convention — but the app must never rely on that shape, because real video
 * ids are independent cuids. Resolving through this route keeps the mock
 * exercising the same code path the real backend does.
 */
route('GET', '/lessons/by-video/:videoId', ({ params }): LessonDetail => {
  requireAuth();
  const lesson = [...lessonIndex.values()].find((l) => l.video?.id === params.videoId);
  if (!lesson) fail('NOT_FOUND', 404, 'Video not found');

  const course = courseOfLesson(lesson.id);
  const state = enrollments.get(course.id);

  if (state === 'ARCHIVED') fail('COURSE_ARCHIVED', 410, 'Archived');
  if (state === 'EXPIRED') fail('ACCESS_EXPIRED', 410, 'Expired');
  if (state !== 'ACTIVE' && !lesson.isPreview) fail('NOT_ENROLLED', 403, 'Locked');

  return { ...lesson, progress: progressStore.get(lesson.id) ?? null };
});

route('POST', '/lessons/:id/complete', ({ params }) => {
  requireAuth();
  const lesson = lessonIndex.get(params.id!);
  if (!lesson) fail('NOT_FOUND', 404, 'Lesson not found');

  const progress: WatchProgress = {
    lessonId: lesson.id,
    positionSeconds: lesson.durationSeconds,
    durationSeconds: lesson.durationSeconds,
    percent: 100,
    completed: true,
    lastWatchedAt: new Date().toISOString(),
  };
  progressStore.set(lesson.id, progress);
  return progress;
});

// ---- playback -------------------------------------------------------------

route('POST', '/playback/videos/:videoId/ticket', ({ params }): PlaybackTicket => {
  requireAuth();
  const videoId = params.videoId!;
  // Look the video up rather than deriving a lesson id from its shape: the
  // real backend's ids carry no such relationship, and the app must not
  // depend on one.
  const lesson = [...lessonIndex.values()].find((l) => l.video?.id === videoId);
  if (!lesson?.video) fail('VIDEO_UNAVAILABLE', 404, 'No video');
  const lessonId = lesson.id;
  if (lesson.video.status === 'PROCESSING') fail('VIDEO_NOT_READY', 409, 'Processing');

  const course = courseOfLesson(lessonId);
  const state = enrollments.get(course.id);

  if (state === 'ARCHIVED') fail('COURSE_ARCHIVED', 410, 'Archived');
  if (state === 'EXPIRED') fail('ACCESS_EXPIRED', 410, 'Expired');
  if (state !== 'ACTIVE' && !lesson.isPreview) fail('PLAYBACK_DENIED', 403, 'No access');

  const ttl = env.playbackTicketTtlSeconds;
  const progress = progressStore.get(lessonId);

  return {
    ticketId: `tkt-${lessonId}-${Date.now()}`,
    // Public Apple test stream — the shape of the contract is what matters
    // here; the real backend returns a signed, expiring R2/CDN URL.
    manifestUrl:
      'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    playbackHeaders: {},
    drm: {
      scheme: env.features.drm ? 'widevine' : 'none',
      licenseUrl: env.features.drm ? 'https://example.com/drm/license' : null,
      certificateUrl: null,
      licenseHeaders: {},
    },
    watermark: {
      primary: mockUser.fullName,
      secondary: `ID: ${mockUser.id}`,
      sessionTag: `mock-${Date.now().toString(36)}`,
      opacity: 0.32,
      moveIntervalSeconds: 20,
    },
    captions: lesson.video.hasCaptions
      ? [
          {
            language: 'en',
            label: 'English',
            url: 'https://example.com/captions/en.vtt',
            isDefault: true,
          },
          {
            language: 'ar',
            label: 'العربية',
            url: 'https://example.com/captions/ar.vtt',
            isDefault: false,
          },
        ]
      : [],
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    ttlSeconds: ttl,
    resumePositionSeconds: progress?.completed ? 0 : (progress?.positionSeconds ?? 0),
    streamSessionId: `sess-${Date.now().toString(36)}`,
    heartbeatIntervalSeconds: 30,
  };
});

route('POST', '/playback/tickets/:ticketId/heartbeat', () => ({ ok: true }));
route('DELETE', '/playback/tickets/:ticketId', () => ({ ok: true }));
route('POST', '/playback/security-events', ({ body }) => {
  log.warn('security event (mock)', body);
  return { ok: true };
});

// ---- progress -------------------------------------------------------------

route('POST', '/progress', ({ body }): WatchProgress => {
  requireAuth();
  const lessonId = String(body.lessonId ?? '');
  const lesson = lessonIndex.get(lessonId);
  if (!lesson) fail('NOT_FOUND', 404, 'Lesson not found');

  const positionSeconds = Number(body.positionSeconds ?? 0);
  const duration = lesson.durationSeconds || 1;
  const percentNow = Math.min(100, Math.round((positionSeconds / duration) * 100));
  const previous = progressStore.get(lessonId);

  const next: WatchProgress = {
    lessonId,
    positionSeconds,
    durationSeconds: duration,
    // Progress never goes backwards — matches the server-side rule.
    percent: Math.max(previous?.percent ?? 0, percentNow),
    completed: (previous?.completed ?? false) || percentNow >= 90,
    lastWatchedAt: new Date().toISOString(),
  };

  progressStore.set(lessonId, next);
  return next;
});

route('POST', '/progress/batch', ({ body }) => {
  const items = Array.isArray(body.items) ? body.items : [];
  for (const raw of items as Record<string, unknown>[]) {
    const lessonId = String(raw.lessonId ?? '');
    const lesson = lessonIndex.get(lessonId);
    if (!lesson) continue;
    const positionSeconds = Number(raw.positionSeconds ?? 0);
    const percent = Math.min(
      100,
      Math.round((positionSeconds / (lesson.durationSeconds || 1)) * 100)
    );
    const previous = progressStore.get(lessonId);
    progressStore.set(lessonId, {
      lessonId,
      positionSeconds,
      durationSeconds: lesson.durationSeconds,
      percent: Math.max(previous?.percent ?? 0, percent),
      completed: (previous?.completed ?? false) || percent >= 90,
      lastWatchedAt: new Date().toISOString(),
    });
  }
  return { accepted: items.length };
});

route('GET', '/progress/continue-watching', () => {
  requireAuth();
  return continueWatching();
});

// ---- attachments ----------------------------------------------------------

route('GET', '/attachments/:id/ticket', ({ params }): AttachmentTicket => {
  requireAuth();
  return {
    attachmentId: params.id!,
    url: 'https://example.com/protected/document.pdf',
    headers: {},
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    watermark: {
      primary: mockUser.fullName,
      secondary: `ID: ${mockUser.id}`,
      sessionTag: `mock-doc-${Date.now().toString(36)}`,
      opacity: 0.25,
      moveIntervalSeconds: 30,
    },
  };
});

// ---- notifications --------------------------------------------------------

route('GET', '/notifications', ({ query }) => {
  requireAuth();
  const onlyUnread = query.unread === 'true';
  const list = onlyUnread ? notifications.filter((n) => !n.read) : notifications;
  return paginate(list, Number(query.page ?? 1));
});

route('GET', '/notifications/unread-count', () => ({
  count: notifications.filter((n) => !n.read).length,
}));

route('POST', '/notifications/:id/read', ({ params }) => {
  const n = notifications.find((x) => x.id === params.id);
  if (n) n.read = true;
  return { ok: true };
});

route('POST', '/notifications/read-all', () => {
  notifications.forEach((n) => (n.read = true));
  return { ok: true };
});

route('POST', '/notifications/devices', () => ({ ok: true }));
route('DELETE', '/notifications/devices/:token', () => ({ ok: true }));
route('GET', '/notifications/preferences', () => ({
  newCourse: true,
  newLesson: true,
  announcements: true,
  payments: true,
}));
route('PUT', '/notifications/preferences', ({ body }) => body);

// ---- search ---------------------------------------------------------------

route('GET', '/search', ({ query }): SearchResultGroup[] => {
  const q = (query.q ?? '').toLowerCase().trim();
  if (q.length < 2) return [];

  const courseHits = courses
    .filter((c) => c.title.toLowerCase().includes(q))
    .map((c) => ({
      id: c.id,
      entity: 'COURSE' as const,
      title: c.title,
      subtitle: c.teacher.fullName,
      thumbnailUrl: c.thumbnailUrl,
      route: `/course/${c.id}`,
      locked: enrollments.get(c.id) !== 'ACTIVE',
    }));

  const lessonHits = [...lessonIndex.values()]
    .filter((l) => l.title.toLowerCase().includes(q))
    .slice(0, 20)
    .map((l) => ({
      id: l.id,
      entity: 'LESSON' as const,
      title: l.title,
      subtitle: courses.find((c) => c.id === l.courseId)?.title ?? null,
      thumbnailUrl: null,
      route: `/lesson/${l.id}`,
      locked: enrollments.get(l.courseId) !== 'ACTIVE' && !l.isPreview,
    }));

  const teacherHits = teachers
    .filter((t) => t.fullName.toLowerCase().includes(q))
    .map((t) => ({
      id: t.id,
      entity: 'TEACHER' as const,
      title: t.fullName,
      subtitle: t.title ?? null,
      thumbnailUrl: t.avatarUrl ?? null,
      route: `/search?teacher=${t.id}`,
      locked: false,
    }));

  const groups: SearchResultGroup[] = [
    { entity: 'COURSE', total: courseHits.length, items: courseHits },
    { entity: 'LESSON', total: lessonHits.length, items: lessonHits },
    { entity: 'TEACHER', total: teacherHits.length, items: teacherHits },
  ];

  return groups.filter((g) => g.items.length > 0);
});

route('GET', '/search/suggestions', ({ query }) => {
  const q = (query.q ?? '').toLowerCase();
  return courses
    .map((c) => c.title)
    .filter((t) => t.toLowerCase().includes(q))
    .slice(0, 6);
});

// ---- profile --------------------------------------------------------------

route('GET', '/profile', () => {
  requireAuth();
  return mockUser;
});

route('PATCH', '/profile', ({ body }) => {
  requireAuth();
  mockUser = { ...mockUser, ...(body as Partial<User>) };
  return mockUser;
});

route('PUT', '/profile/password', ({ body }) => {
  const current = String(body.currentPassword ?? '');
  if (current.length < 8) fail('INVALID_CREDENTIALS', 401, 'Wrong password');
  return { ok: true };
});

// ---- devices --------------------------------------------------------------

route('GET', '/devices', (): AuthorizedDevice[] => {
  requireAuth();
  return [
    {
      id: 'dev-1',
      name: 'This device',
      platform: 'android',
      model: 'Pixel 8',
      lastSeenAt: new Date().toISOString(),
      current: true,
      authorizedAt: '2026-02-01T10:00:00.000Z',
    },
  ];
});

route('POST', '/devices/change-request', () => ({ ok: true, status: 'PENDING' }));

route('GET', '/meta/health', () => ({ status: 'ok', mock: true }));

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function fakeJwt(expiresInSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: mockUser.id,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      mock: true,
    })
  );
  return `${header}.${payload}.mock`;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64url(input: string): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i += 1) {
    acc = (acc << 8) | input.charCodeAt(i);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64[(acc >> bits) & 63];
    }
  }
  if (bits > 0) out += B64[(acc << (6 - bits)) & 63];
  return out;
}

export async function mockRequest<T>(
  config: AxiosRequestConfig & { url: string },
  _options: RequestOptions = {}
): Promise<T> {
  await sleep(LATENCY_MS);

  const method = (config.method ?? 'get').toUpperCase();
  const [rawPath = '', rawQuery = ''] = config.url.split('?');
  const path = rawPath.replace(/\/$/, '') || '/';

  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.params ?? {})) {
    if (v !== undefined && v !== null) query[k] = String(v);
  }
  for (const pair of rawQuery.split('&').filter(Boolean)) {
    const [k, v = ''] = pair.split('=');
    if (k) query[k] = decodeURIComponent(v);
  }

  for (const r of routes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(path);
    if (!match) continue;

    const params: Record<string, string> = {};
    r.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1] ?? '');
    });

    const body = (config.data ?? {}) as Record<string, unknown>;
    log.debug('mock', { method, path });
    return r.handler({ body, params, query }) as T;
  }

  log.warn('unhandled mock route', { method, path });
  throw new ApiError({
    code: 'NOT_FOUND',
    status: 404,
    message: `No mock handler for ${method} ${path}`,
  });
}

/** Test helper — resets mutable mock state between test cases. */
export function __resetMockState() {
  loggedIn = false;
  mockUser = { ...currentUser };
  usedCodes.clear();
  enrollments.clear();
  courses.forEach((c) => enrollments.set(c.id, c.access.state));
}
