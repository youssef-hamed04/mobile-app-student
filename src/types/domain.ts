/**
 * Domain model mirrored from the PostgreSQL/Prisma schema.
 * Everything the UI renders comes from here — no hardcoded structures.
 */

export type UserRole = 'MASTER' | 'ADMIN' | 'TEACHER' | 'STUDENT';
export type Gender = 'MALE' | 'FEMALE';
export type AccountStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';

export interface University {
  id: string;
  name: string;
  nameAr: string;
  logoUrl?: string | null;
}

export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  nameAr: string;
}

export interface Department {
  id: string;
  facultyId: string;
  name: string;
  nameAr: string;
}

export interface AcademicYear {
  id: string;
  /** e.g. 1..5 — ordering only, never assume a fixed count. */
  order: number;
  name: string;
  nameAr: string;
}

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  gender: Gender;
  avatarUrl?: string | null;
  university: University | null;
  faculty: Faculty | null;
  department: Department | null;
  academicYear: AcademicYear | null;
  createdAt: string;
}

export interface Teacher {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  title?: string | null;
  bio?: string | null;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'HIDDEN';

/** How a student is allowed to obtain access. Backend decides; UI renders. */
export type EnrollmentMethod = 'FREE' | 'PAYMENT' | 'CODE' | 'ADMIN_APPROVAL';

export type AccessState =
  | 'NOT_ENROLLED'
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ARCHIVED';

export interface Money {
  amount: number;
  currency: string;
}

export interface CourseAccess {
  state: AccessState;
  /** Null for lifetime access. */
  expiresAt: string | null;
  enrolledAt: string | null;
  /** Methods the student may use to gain access, ordered by preference. */
  availableMethods: EnrollmentMethod[];
}

export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  /** 0..100 */
  percent: number;
  lastLessonId: string | null;
  lastWatchedAt: string | null;
}

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  teacher: Teacher;
  status: CourseStatus;
  price: Money | null;
  isFree: boolean;
  lessonCount: number;
  sectionCount: number;
  totalDurationSeconds: number;
  rating?: number | null;
  studentCount?: number | null;
  university?: Pick<University, 'id' | 'name' | 'nameAr'> | null;
  academicYear?: Pick<AcademicYear, 'id' | 'name' | 'nameAr'> | null;
  access: CourseAccess;
  progress: CourseProgress | null;
  publishedAt: string | null;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  /** Dynamic — never assume a count, order or naming scheme. */
  sections: CourseSection[];
  attachments: Attachment[];
  requirements: string[];
  outcomes: string[];
  updatedAt: string;
}

export interface CourseSection {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  /** Server-provided ordering. Render in this order, do not sort locally. */
  order: number;
  lessonCount: number;
  durationSeconds: number;
  /** A section can be individually locked (drip content, staged release). */
  locked: boolean;
  unlocksAt: string | null;
  progressPercent: number;
  lessons: LessonSummary[];
}

// ---------------------------------------------------------------------------
// Lessons & video
// ---------------------------------------------------------------------------

export type LessonKind = 'VIDEO' | 'DOCUMENT' | 'QUIZ' | 'LIVE';

export interface LessonSummary {
  id: string;
  sectionId: string;
  courseId: string;
  title: string;
  kind: LessonKind;
  order: number;
  durationSeconds: number;
  /** Free preview lessons are watchable before enrolling. */
  isPreview: boolean;
  locked: boolean;
  attachmentCount: number;
  progress: WatchProgress | null;
}

export interface LessonDetail extends LessonSummary {
  description: string | null;
  video: VideoRef | null;
  attachments: Attachment[];
  nextLessonId: string | null;
  previousLessonId: string | null;
  /**
   * Video ids for the adjacent lessons.
   *
   * The player route is addressed by video id, and a video id cannot be
   * derived from a lesson id — they are independent cuids. The server
   * therefore supplies both. Null when the neighbouring lesson has no video
   * (a document or quiz lesson), which is the signal to leave the player
   * rather than autoplay into nothing.
   */
  nextVideoId: string | null;
  previousVideoId: string | null;
  /** Completion rule configured per course; the UI must not invent one. */
  completionRule: CompletionRule;
}

export interface CompletionRule {
  type: 'WATCH_PERCENT' | 'MANUAL' | 'WATCH_FULL';
  /** Required watched percentage for WATCH_PERCENT (0..100). */
  threshold: number;
  /** If true, seeking past unwatched content does not count toward progress. */
  requireContiguous: boolean;
}

/**
 * Metadata only. There is no URL here on purpose — a playable URL is issued
 * per-session by POST /playback/tickets and expires.
 */
export interface VideoRef {
  id: string;
  lessonId: string;
  courseId: string;
  assetId: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  /** Ladder the asset was packaged at; the player exposes these in the menu. */
  availableQualities: string[];
  hasCaptions: boolean;
  captionLanguages: string[];
  status: 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
}

export type DrmScheme = 'widevine' | 'fairplay' | 'none';

/**
 * Short-lived playback authorization (spec §35).
 * Issued only after the backend has verified: auth -> account -> course ->
 * lesson -> video -> device -> session.
 */
export interface PlaybackTicket {
  ticketId: string;
  /** Signed, expiring HLS master playlist URL. */
  manifestUrl: string;
  /** Headers/cookies the player must present to the CDN. */
  playbackHeaders: Record<string, string>;
  drm: {
    scheme: DrmScheme;
    licenseUrl: string | null;
    /** FairPlay only. */
    certificateUrl: string | null;
    licenseHeaders: Record<string, string>;
  };
  /** Server-rendered watermark payload — the client cannot choose its own. */
  watermark: WatermarkPayload;
  captions: CaptionTrack[];
  /** Absolute ISO timestamp when the manifest URL stops working. */
  expiresAt: string;
  /** Seconds; the client refreshes the ticket before this elapses. */
  ttlSeconds: number;
  /** Where to resume from, authoritative server-side value. */
  resumePositionSeconds: number;
  /** Backend-enforced concurrency slot for this playback session. */
  streamSessionId: string;
  heartbeatIntervalSeconds: number;
}

export interface WatermarkPayload {
  /** Pre-composed primary line, e.g. "Ahmed Mohamed Ali". */
  primary: string;
  /** Pre-composed secondary line, e.g. "ID: 12345 • 01:23:45". */
  secondary: string;
  /** Signed opaque token forensically tying the session to the user. */
  sessionTag: string;
  opacity: number;
  /** Seconds between reposition steps. */
  moveIntervalSeconds: number;
}

export interface CaptionTrack {
  language: string;
  label: string;
  url: string;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface WatchProgress {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number;
  /** 0..100, monotonically non-decreasing. */
  percent: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface ContinueWatchingItem {
  lesson: LessonSummary;
  course: Pick<CourseSummary, 'id' | 'title' | 'thumbnailUrl' | 'teacher'>;
  progress: WatchProgress;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export type AttachmentKind = 'PDF' | 'IMAGE' | 'DOC' | 'SHEET' | 'LINK' | 'OTHER';

export interface Attachment {
  id: string;
  lessonId: string | null;
  courseId: string;
  title: string;
  kind: AttachmentKind;
  sizeBytes: number | null;
  pageCount: number | null;
  /** Protected attachments are streamed through a ticket, never downloaded. */
  protected: boolean;
  downloadable: boolean;
  locked: boolean;
}

export interface AttachmentTicket {
  attachmentId: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
  watermark: WatermarkPayload;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export interface EnrollmentResult {
  state: AccessState;
  courseId: string;
  /** Present when the chosen method requires an external payment step. */
  payment?: {
    provider: string;
    checkoutUrl: string;
    reference: string;
  } | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'NEW_COURSE'
  | 'NEW_SECTION'
  | 'NEW_LESSON'
  | 'NEW_VIDEO'
  | 'ANNOUNCEMENT'
  | 'PAYMENT'
  | 'ENROLLMENT'
  | 'COURSE_UPDATE'
  | 'ADMIN'
  | 'SECURITY';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  /** Deep-link target, e.g. "/course/abc" — validated before navigating. */
  route: string | null;
  imageUrl: string | null;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchEntity = 'COURSE' | 'LESSON' | 'TEACHER' | 'ATTACHMENT';

export interface SearchResultGroup {
  entity: SearchEntity;
  total: number;
  items: SearchResultItem[];
}

export interface SearchResultItem {
  id: string;
  entity: SearchEntity;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  route: string;
  locked: boolean;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface AuthorizedDevice {
  id: string;
  name: string;
  platform: string;
  model: string;
  lastSeenAt: string;
  current: boolean;
  authorizedAt: string;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export interface HomeFeed {
  continueWatching: ContinueWatchingItem[];
  myCourses: CourseSummary[];
  newCourses: CourseSummary[];
  recommended: CourseSummary[];
  announcements: AppNotification[];
  stats: {
    enrolledCourses: number;
    completedLessons: number;
    watchTimeSeconds: number;
    streakDays: number;
  };
}

// ---------------------------------------------------------------------------
// Advertisements
// ---------------------------------------------------------------------------

/**
 * Where tapping a promotion sends the student.
 *
 * `NONE` is a first-class case, not a fallback: a purely informational banner
 * should be inert rather than pretending to be tappable.
 */
export type AdTargetType =
  | 'NONE'
  | 'COURSE'
  | 'SECTION'
  | 'LESSON'
  | 'EXTERNAL_URL'
  | 'APP_SCREEN';

export interface AdTarget {
  type: AdTargetType;
  /** Entity id for COURSE / SECTION / LESSON. */
  entityId: string | null;
  /**
   * Absolute http(s) URL for EXTERNAL_URL, or an in-app path for APP_SCREEN
   * and SECTION.
   *
   * The destination is expressed by the server rather than derived from a
   * client-side map, so the admin dashboard can add destinations without an
   * app release. See `resolveAdTarget` for how it is validated before use.
   */
  url: string | null;
}

/**
 * A promotional banner served to the student home screen.
 *
 * Shaped for an admin-managed catalogue: `active`, `startsAt` and `endsAt`
 * are enforced server-side (the client never receives what it should not
 * show), and are present here only so a persisted cache can be re-checked
 * before an expired banner is painted from disk.
 */
export interface Advertisement {
  id: string;
  imageUrl: string;
  /**
   * Aspect ratio the artwork was authored at (width / height).
   *
   * Supplied by the server so the carousel can reserve the exact box before
   * the image resolves — without it, banners of differing ratios reflow the
   * home screen after paint.
   */
  aspectRatio: number | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  target: AdTarget;
  displayOrder: number;
  startsAt: string | null;
  endsAt: string | null;
}
