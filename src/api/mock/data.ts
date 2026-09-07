import type {
  AcademicYear,
  AppNotification,
  Attachment,
  CourseDetail,
  CourseSection,
  Department,
  Faculty,
  LessonDetail,
  Teacher,
  University,
  User,
  WatchProgress,
} from '@/types/domain';

/**
 * Fixture data for the mock backend.
 *
 * Deliberately *irregular*: courses have different numbers of sections with
 * different naming schemes (Before/After Midterm vs Unit 1..n vs Part 1..4),
 * so the UI is exercised against the dynamic-structure requirement rather
 * than a convenient three-part shape.
 */

export const universities: University[] = [
  { id: 'u1', name: 'Cairo University', nameAr: 'جامعة القاهرة', logoUrl: null },
  { id: 'u2', name: 'Ain Shams University', nameAr: 'جامعة عين شمس', logoUrl: null },
  { id: 'u3', name: 'Alexandria University', nameAr: 'جامعة الإسكندرية', logoUrl: null },
];

export const faculties: Faculty[] = [
  { id: 'f1', universityId: 'u1', name: 'Faculty of Engineering', nameAr: 'كلية الهندسة' },
  { id: 'f2', universityId: 'u1', name: 'Faculty of Medicine', nameAr: 'كلية الطب' },
  { id: 'f3', universityId: 'u1', name: 'Faculty of Commerce', nameAr: 'كلية التجارة' },
  { id: 'f4', universityId: 'u2', name: 'Faculty of Engineering', nameAr: 'كلية الهندسة' },
  { id: 'f5', universityId: 'u2', name: 'Faculty of Science', nameAr: 'كلية العلوم' },
  { id: 'f6', universityId: 'u3', name: 'Faculty of Pharmacy', nameAr: 'كلية الصيدلة' },
];

export const departments: Department[] = [
  { id: 'd1', facultyId: 'f1', name: 'Computer Engineering', nameAr: 'هندسة الحاسبات' },
  { id: 'd2', facultyId: 'f1', name: 'Electrical Power', nameAr: 'القوى الكهربية' },
  { id: 'd3', facultyId: 'f1', name: 'Civil Engineering', nameAr: 'الهندسة المدنية' },
  { id: 'd4', facultyId: 'f2', name: 'General Medicine', nameAr: 'الطب العام' },
  { id: 'd5', facultyId: 'f3', name: 'Accounting', nameAr: 'المحاسبة' },
  { id: 'd6', facultyId: 'f4', name: 'Mechatronics', nameAr: 'الميكاترونيات' },
  { id: 'd7', facultyId: 'f5', name: 'Biotechnology', nameAr: 'التقنية الحيوية' },
  { id: 'd8', facultyId: 'f6', name: 'Clinical Pharmacy', nameAr: 'الصيدلة الإكلينيكية' },
];

export const academicYears: AcademicYear[] = [
  { id: 'y1', order: 1, name: 'First year', nameAr: 'الفرقة الأولى' },
  { id: 'y2', order: 2, name: 'Second year', nameAr: 'الفرقة الثانية' },
  { id: 'y3', order: 3, name: 'Third year', nameAr: 'الفرقة الثالثة' },
  { id: 'y4', order: 4, name: 'Fourth year', nameAr: 'الفرقة الرابعة' },
  { id: 'y5', order: 5, name: 'Fifth year', nameAr: 'الفرقة الخامسة' },
];

export const teachers: Teacher[] = [
  {
    id: 't1',
    fullName: 'Dr. Mostafa El-Sayed',
    title: 'Professor of Signals & Systems',
    avatarUrl: null,
    bio: 'Twenty years teaching signal processing and control systems.',
  },
  {
    id: 't2',
    fullName: 'Dr. Hoda Kamal',
    title: 'Lecturer, Data Structures',
    avatarUrl: null,
    bio: 'Focuses on algorithmic thinking and interview-grade problem solving.',
  },
  {
    id: 't3',
    fullName: 'Eng. Karim Abdallah',
    title: 'Senior Teaching Assistant',
    avatarUrl: null,
    bio: 'Practical, exam-focused revision sessions.',
  },
  {
    id: 't4',
    fullName: 'Dr. Nourhan Fathy',
    title: 'Associate Professor of Pharmacology',
    avatarUrl: null,
    bio: null,
  },
];

export const currentUser: User = {
  id: '12345',
  fullName: 'Ahmed Mohamed Ali',
  phone: '01001234567',
  role: 'STUDENT',
  status: 'ACTIVE',
  gender: 'MALE',
  avatarUrl: null,
  university: universities[0]!,
  faculty: faculties[0]!,
  department: departments[0]!,
  academicYear: academicYears[2]!,
  createdAt: '2025-09-14T08:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Course building helpers
// ---------------------------------------------------------------------------

let lessonSeq = 0;

function makeLesson(
  courseId: string,
  sectionId: string,
  title: string,
  order: number,
  opts: Partial<{ duration: number; preview: boolean; locked: boolean; kind: 'VIDEO' | 'DOCUMENT' }> = {}
) {
  lessonSeq += 1;
  const id = `l${lessonSeq}`;
  return {
    id,
    sectionId,
    courseId,
    title,
    kind: (opts.kind ?? 'VIDEO') as 'VIDEO' | 'DOCUMENT',
    order,
    durationSeconds: opts.duration ?? 600 + ((lessonSeq * 137) % 2400),
    isPreview: opts.preview ?? false,
    locked: opts.locked ?? false,
    attachmentCount: lessonSeq % 3 === 0 ? 2 : 0,
    progress: null as WatchProgress | null,
  };
}

function makeSection(
  courseId: string,
  title: string,
  order: number,
  lessonTitles: string[],
  opts: Partial<{ locked: boolean; description: string; unlocksAt: string }> = {}
): CourseSection {
  const id = `${courseId}-s${order}`;
  const lessons = lessonTitles.map((t, i) =>
    makeLesson(courseId, id, t, i + 1, {
      preview: order === 1 && i === 0,
      locked: opts.locked ?? false,
    })
  );

  return {
    id,
    courseId,
    title,
    description: opts.description ?? null,
    order,
    lessonCount: lessons.length,
    durationSeconds: lessons.reduce((a, l) => a + l.durationSeconds, 0),
    locked: opts.locked ?? false,
    unlocksAt: opts.unlocksAt ?? null,
    progressPercent: 0,
    lessons,
  };
}

function attachment(
  courseId: string,
  lessonId: string | null,
  title: string,
  kind: Attachment['kind'] = 'PDF'
): Attachment {
  return {
    id: `a-${courseId}-${(lessonId ?? 'course')}-${title.length}-${kind}`,
    lessonId,
    courseId,
    title,
    kind,
    sizeBytes: 1_200_000 + title.length * 40_000,
    pageCount: kind === 'PDF' ? 12 + (title.length % 20) : null,
    protected: true,
    downloadable: false,
    locked: false,
  };
}

// ---------------------------------------------------------------------------
// Courses — three deliberately different section structures
// ---------------------------------------------------------------------------

const c1Sections = [
  makeSection('c1', 'Before Midterm', 1, [
    'Course introduction and syllabus',
    'Continuous-time signals',
    'Discrete-time signals',
    'Linear time-invariant systems',
    'Convolution in depth',
  ], { description: 'Everything covered up to the midterm exam.' }),
  makeSection('c1', 'Midterm Revision', 2, [
    'Midterm revision: solved problems',
    'Midterm revision: past papers',
  ], { description: 'Focused revision before the midterm.' }),
  makeSection('c1', 'After Midterm', 3, [
    'Fourier series',
    'Fourier transform',
    'Laplace transform',
    'Z-transform',
    'Sampling theorem',
    'Final revision',
  ]),
];

const c2Sections = [
  makeSection('c2', 'Unit 1 — Foundations', 1, [
    'Complexity analysis',
    'Arrays and dynamic arrays',
    'Linked lists',
  ]),
  makeSection('c2', 'Unit 2 — Linear structures', 2, [
    'Stacks',
    'Queues and deques',
    'Applications and problems',
  ]),
  makeSection('c2', 'Midterm', 3, ['Midterm revision session'], {
    description: 'One long revision session covering units 1 and 2.',
  }),
  makeSection('c2', 'Unit 3 — Trees and graphs', 4, [
    'Binary trees',
    'Balanced trees',
    'Graph representations',
    'BFS and DFS',
  ]),
  makeSection('c2', 'Final Revision', 5, [
    'Final revision part 1',
    'Final revision part 2',
  ], { locked: true, unlocksAt: '2026-09-01T00:00:00.000Z' }),
];

const c3Sections = [
  makeSection('c3', 'Part 1', 1, ['Pharmacokinetics basics', 'Absorption and distribution']),
  makeSection('c3', 'Part 2', 2, ['Metabolism', 'Excretion', 'Clinical cases']),
  makeSection('c3', 'Part 3', 3, ['Autonomic pharmacology', 'Cardiovascular drugs']),
  makeSection('c3', 'Part 4', 4, ['CNS drugs', 'Antimicrobials', 'Final review']),
];

const c4Sections = [
  makeSection('c4', 'Introduction', 1, ['Welcome and how to use this course']),
  makeSection('c4', 'Core accounting cycle', 2, [
    'Journal entries',
    'Ledgers and trial balance',
    'Adjusting entries',
    'Closing the books',
  ]),
];

function courseTotals(sections: CourseSection[]) {
  const lessonCount = sections.reduce((a, s) => a + s.lessonCount, 0);
  const totalDurationSeconds = sections.reduce((a, s) => a + s.durationSeconds, 0);
  return { lessonCount, sectionCount: sections.length, totalDurationSeconds };
}

export const courses: CourseDetail[] = [
  {
    id: 'c1',
    title: 'Signals and Systems',
    slug: 'signals-and-systems',
    shortDescription:
      'A complete third-year treatment of continuous and discrete signals, transforms and LTI systems.',
    description:
      'This course walks through the full Signals and Systems syllabus with worked examples from past exams. Each section builds on the previous one, and every lesson includes a downloadable problem set.',
    thumbnailUrl: null,
    teacher: teachers[0]!,
    status: 'PUBLISHED',
    price: { amount: 600, currency: 'EGP' },
    isFree: false,
    rating: 4.8,
    studentCount: 1240,
    university: { id: 'u1', name: 'Cairo University', nameAr: 'جامعة القاهرة' },
    academicYear: { id: 'y3', name: 'Third year', nameAr: 'الفرقة الثالثة' },
    access: {
      state: 'ACTIVE',
      expiresAt: '2026-12-31T23:59:59.000Z',
      enrolledAt: '2026-02-01T10:00:00.000Z',
      availableMethods: ['PAYMENT', 'CODE'],
    },
    progress: {
      completedLessons: 4,
      totalLessons: 13,
      percent: 31,
      lastLessonId: c1Sections[0]!.lessons[4]!.id,
      lastWatchedAt: '2026-08-15T19:20:00.000Z',
    },
    sections: c1Sections,
    attachments: [
      attachment('c1', null, 'Full course notes'),
      attachment('c1', null, 'Formula sheet'),
    ],
    requirements: ['Calculus I & II', 'Basic linear algebra'],
    outcomes: [
      'Analyse LTI systems in time and frequency domains',
      'Apply Fourier, Laplace and Z transforms confidently',
      'Solve exam-style problems under time pressure',
    ],
    publishedAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...courseTotals(c1Sections),
  },

  {
    id: 'c2',
    title: 'Data Structures and Algorithms',
    slug: 'data-structures-algorithms',
    shortDescription:
      'From complexity analysis to graphs, with an exam-focused revision track.',
    description:
      'A practical, problem-driven data structures course. Structured as five units so you can follow the department schedule week by week.',
    thumbnailUrl: null,
    teacher: teachers[1]!,
    status: 'PUBLISHED',
    price: { amount: 450, currency: 'EGP' },
    isFree: false,
    rating: 4.9,
    studentCount: 2110,
    university: { id: 'u1', name: 'Cairo University', nameAr: 'جامعة القاهرة' },
    academicYear: { id: 'y2', name: 'Second year', nameAr: 'الفرقة الثانية' },
    access: {
      state: 'NOT_ENROLLED',
      expiresAt: null,
      enrolledAt: null,
      availableMethods: ['PAYMENT', 'CODE', 'ADMIN_APPROVAL'],
    },
    progress: null,
    sections: c2Sections,
    attachments: [attachment('c2', null, 'Problem set archive')],
    requirements: ['Introductory programming in C++ or Java'],
    outcomes: [
      'Pick the right data structure for a problem',
      'Reason about time and space complexity',
      'Implement trees and graph traversals from scratch',
    ],
    publishedAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...courseTotals(c2Sections),
  },

  {
    id: 'c3',
    title: 'Clinical Pharmacology',
    slug: 'clinical-pharmacology',
    shortDescription: 'Four-part pharmacology course with clinical case discussions.',
    description:
      'Covers pharmacokinetics, pharmacodynamics and the major drug classes, with case-based discussion in every part.',
    thumbnailUrl: null,
    teacher: teachers[3]!,
    status: 'PUBLISHED',
    price: null,
    isFree: true,
    rating: 4.6,
    studentCount: 640,
    university: { id: 'u3', name: 'Alexandria University', nameAr: 'جامعة الإسكندرية' },
    academicYear: { id: 'y4', name: 'Fourth year', nameAr: 'الفرقة الرابعة' },
    access: {
      state: 'NOT_ENROLLED',
      expiresAt: null,
      enrolledAt: null,
      availableMethods: ['FREE'],
    },
    progress: null,
    sections: c3Sections,
    attachments: [],
    requirements: ['Physiology', 'Biochemistry'],
    outcomes: ['Explain drug handling by the body', 'Reason about drug interactions'],
    publishedAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    ...courseTotals(c3Sections),
  },

  {
    id: 'c4',
    title: 'Financial Accounting — Semester Archive',
    slug: 'financial-accounting-archive',
    shortDescription: 'Archived course from the previous academic year.',
    description:
      'This course has been archived. Enrollment records and payment history are preserved, but the content is no longer available.',
    thumbnailUrl: null,
    teacher: teachers[2]!,
    status: 'ARCHIVED',
    price: { amount: 300, currency: 'EGP' },
    isFree: false,
    rating: 4.2,
    studentCount: 880,
    university: { id: 'u1', name: 'Cairo University', nameAr: 'جامعة القاهرة' },
    academicYear: { id: 'y1', name: 'First year', nameAr: 'الفرقة الأولى' },
    access: {
      state: 'ARCHIVED',
      expiresAt: '2026-06-30T23:59:59.000Z',
      enrolledAt: '2025-10-01T00:00:00.000Z',
      availableMethods: [],
    },
    progress: {
      completedLessons: 5,
      totalLessons: 5,
      percent: 100,
      lastLessonId: null,
      lastWatchedAt: '2026-05-20T12:00:00.000Z',
    },
    sections: c4Sections,
    attachments: [],
    requirements: [],
    outcomes: [],
    publishedAt: '2025-09-01T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...courseTotals(c4Sections),
  },

  {
    id: 'c5',
    title: 'Advanced Control Systems',
    slug: 'advanced-control-systems',
    shortDescription: 'State-space methods, stability and modern control design.',
    description:
      'A fourth-year control course. Access requires administration approval because seats are limited.',
    thumbnailUrl: null,
    teacher: teachers[0]!,
    status: 'PUBLISHED',
    price: { amount: 750, currency: 'EGP' },
    isFree: false,
    rating: 4.7,
    studentCount: 310,
    university: { id: 'u2', name: 'Ain Shams University', nameAr: 'جامعة عين شمس' },
    academicYear: { id: 'y4', name: 'Fourth year', nameAr: 'الفرقة الرابعة' },
    access: {
      state: 'PENDING_APPROVAL',
      expiresAt: null,
      enrolledAt: null,
      availableMethods: ['ADMIN_APPROVAL'],
    },
    progress: null,
    sections: [
      makeSection('c5', 'Module A', 1, ['State-space representation', 'Controllability']),
      makeSection('c5', 'Module B', 2, ['Observability', 'Pole placement', 'LQR']),
    ],
    attachments: [],
    requirements: ['Signals and Systems'],
    outcomes: ['Design state feedback controllers'],
    publishedAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    lessonCount: 5,
    sectionCount: 2,
    totalDurationSeconds: 9000,
  },

  {
    id: 'c6',
    title: 'Engineering Mathematics — Expired Access',
    slug: 'engineering-mathematics',
    shortDescription: 'Your access to this course has ended.',
    description: 'Renew access through the administration to continue watching.',
    thumbnailUrl: null,
    teacher: teachers[2]!,
    status: 'PUBLISHED',
    price: { amount: 400, currency: 'EGP' },
    isFree: false,
    rating: 4.4,
    studentCount: 1500,
    university: { id: 'u1', name: 'Cairo University', nameAr: 'جامعة القاهرة' },
    academicYear: { id: 'y2', name: 'Second year', nameAr: 'الفرقة الثانية' },
    access: {
      state: 'EXPIRED',
      expiresAt: '2026-07-01T00:00:00.000Z',
      enrolledAt: '2026-01-05T00:00:00.000Z',
      availableMethods: ['PAYMENT', 'CODE'],
    },
    progress: {
      completedLessons: 2,
      totalLessons: 4,
      percent: 50,
      lastLessonId: null,
      lastWatchedAt: '2026-06-25T09:00:00.000Z',
    },
    sections: [
      makeSection('c6', 'Section One', 1, ['ODEs', 'PDEs']),
      makeSection('c6', 'Section Two', 2, ['Complex analysis', 'Numerical methods']),
    ],
    attachments: [],
    requirements: [],
    outcomes: [],
    publishedAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    lessonCount: 4,
    sectionCount: 2,
    totalDurationSeconds: 7200,
  },
];

// ---------------------------------------------------------------------------
// Lessons index
// ---------------------------------------------------------------------------

export const lessonIndex = new Map<string, LessonDetail>();

for (const course of courses) {
  const flat = course.sections.flatMap((s) => s.lessons);
  flat.forEach((lesson, i) => {
    const previous = flat[i - 1]?.id ?? null;
    const next = flat[i + 1]?.id ?? null;
    // Mirrors the backend: adjacent VIDEO ids, null when the neighbour has no
    // video. The mock's id convention is `v-<lessonId>`, but nothing outside
    // this file may assume that.
    const previousVideoId =
      flat[i - 1] && flat[i - 1]!.kind === 'VIDEO' ? `v-${flat[i - 1]!.id}` : null;
    const nextVideoId =
      flat[i + 1] && flat[i + 1]!.kind === 'VIDEO' ? `v-${flat[i + 1]!.id}` : null;

    lessonIndex.set(lesson.id, {
      ...lesson,
      description:
        'This lesson covers the topic end to end with worked examples. Watch the video, then try the attached problem set.',
      video:
        lesson.kind === 'VIDEO'
          ? {
              id: `v-${lesson.id}`,
              lessonId: lesson.id,
              courseId: course.id,
              assetId: `asset-${lesson.id}`,
              durationSeconds: lesson.durationSeconds,
              thumbnailUrl: null,
              availableQualities: ['360p', '480p', '720p', '1080p'],
              hasCaptions: i % 4 === 0,
              captionLanguages: i % 4 === 0 ? ['ar', 'en'] : [],
              status: course.id === 'c5' && i === 0 ? 'PROCESSING' : 'READY',
            }
          : null,
      attachments:
        lesson.attachmentCount > 0
          ? [
              attachment(course.id, lesson.id, `${lesson.title} — problem set`),
              attachment(course.id, lesson.id, `${lesson.title} — slides`, 'DOC'),
            ]
          : [],
      nextLessonId: next,
      previousLessonId: previous,
      nextVideoId,
      previousVideoId,
      completionRule: {
        type: 'WATCH_PERCENT',
        threshold: 90,
        requireContiguous: true,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Progress + notifications
// ---------------------------------------------------------------------------

export const progressStore = new Map<string, WatchProgress>();

const seededLessonId = c1Sections[0]!.lessons[4]!.id;
progressStore.set(seededLessonId, {
  lessonId: seededLessonId,
  positionSeconds: 412,
  durationSeconds: c1Sections[0]!.lessons[4]!.durationSeconds,
  percent: 38,
  completed: false,
  lastWatchedAt: '2026-08-15T19:20:00.000Z',
});

for (const l of c1Sections[0]!.lessons.slice(0, 4)) {
  progressStore.set(l.id, {
    lessonId: l.id,
    positionSeconds: l.durationSeconds,
    durationSeconds: l.durationSeconds,
    percent: 100,
    completed: true,
    lastWatchedAt: '2026-08-12T18:00:00.000Z',
  });
}

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'NEW_LESSON',
    title: 'New lesson: Fourier transform',
    body: 'A new lesson was added to Signals and Systems — After Midterm.',
    read: false,
    createdAt: '2026-08-16T09:15:00.000Z',
    route: '/course/c1',
    imageUrl: null,
  },
  {
    id: 'n2',
    kind: 'ANNOUNCEMENT',
    title: 'Exam schedule published',
    body: 'The end-of-term schedule is now available on the faculty portal.',
    read: false,
    createdAt: '2026-08-14T14:00:00.000Z',
    route: null,
    imageUrl: null,
  },
  {
    id: 'n3',
    kind: 'ENROLLMENT',
    title: 'Access request received',
    body: 'Your request to join Advanced Control Systems is under review.',
    read: true,
    createdAt: '2026-08-11T11:30:00.000Z',
    route: '/course/c5',
    imageUrl: null,
  },
  {
    id: 'n4',
    kind: 'SECURITY',
    title: 'New sign-in on your account',
    body: 'Your account was used on this device. If this was not you, contact the administration.',
    read: true,
    createdAt: '2026-08-01T08:00:00.000Z',
    route: '/settings/security',
    imageUrl: null,
  },
];

/** Valid mock access codes, keyed by course. */
export const accessCodes: Record<string, string[]> = {
  c2: ['DSA1-2026-ABCD'],
  c1: ['SIG1-2026-WXYZ'],
  c6: ['MATH-2026-RENEW'],
};

export const usedCodes = new Set<string>();
