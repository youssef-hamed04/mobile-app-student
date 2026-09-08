/**
 * Single source of truth for REST paths.
 *
 * Keeping every path here means the NestJS controllers can be renamed in one
 * place, and it makes the contract auditable (see docs/API_CONTRACT.md).
 */
export const Endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    session: '/auth/session',
    /**
     * Password change lives under /auth, not /profile: the backend groups
     * every credential operation behind one rate limit and one audit
     * category. /profile is profile data only.
     */
    changePassword: '/auth/password',
  },

  catalog: {
    universities: '/catalog/universities',
    faculties: (universityId: string) =>
      `/catalog/universities/${universityId}/faculties`,
    departments: (facultyId: string) =>
      `/catalog/faculties/${facultyId}/departments`,
    academicYears: '/catalog/academic-years',
  },

  home: {
    feed: '/home/feed',
  },

  ads: {
    /**
     * GET — active, in-window promotions for the current student, already
     * ordered. Filtering by schedule and audience is the server's job; the
     * app renders what it is given.
     */
    list: '/ads',
  },

  courses: {
    list: '/courses',
    detail: (id: string) => `/courses/${id}`,
    sections: (id: string) => `/courses/${id}/sections`,
    myCourses: '/courses/mine',
    progress: (id: string) => `/courses/${id}/progress`,
    enroll: (id: string) => `/courses/${id}/enroll`,
    redeemCode: (id: string) => `/courses/${id}/redeem`,
    attachments: (id: string) => `/courses/${id}/attachments`,
  },

  lessons: {
    detail: (id: string) => `/lessons/${id}`,
    /**
     * The player route is addressed by video id, but needs lesson metadata
     * (title, completion rule, next pointer). Video ids and lesson ids are
     * independent cuids — one cannot be derived from the other.
     */
    byVideo: (videoId: string) => `/lessons/by-video/${videoId}`,
    complete: (id: string) => `/lessons/${id}/complete`,
  },

  playback: {
    /** POST — runs the full authorization chain, returns a short-lived ticket. */
    ticket: (videoId: string) => `/playback/videos/${videoId}/ticket`,
    /** POST — keeps the concurrency slot alive and reports position. */
    heartbeat: (ticketId: string) => `/playback/tickets/${ticketId}/heartbeat`,
    /** DELETE — releases the concurrency slot immediately. */
    release: (ticketId: string) => `/playback/tickets/${ticketId}`,
    /** POST — reports a client-side capture/integrity event for audit. */
    securityEvent: '/playback/security-events',
  },

  progress: {
    upsert: '/progress',
    batch: '/progress/batch',
    continueWatching: '/progress/continue-watching',
  },

  attachments: {
    ticket: (id: string) => `/attachments/${id}/ticket`,
  },

  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
    unreadCount: '/notifications/unread-count',
    registerPushToken: '/notifications/devices',
    unregisterPushToken: (token: string) => `/notifications/devices/${token}`,
    preferences: '/notifications/preferences',
  },

  search: {
    query: '/search',
    suggestions: '/search/suggestions',
  },

  profile: {
    me: '/profile',
    update: '/profile',
    avatar: '/profile/avatar',
  },

  devices: {
    list: '/devices',
    current: '/devices/current',
    requestChange: '/devices/change-request',
  },

  meta: {
    health: '/meta/health',
    appConfig: '/meta/app-config',
  },
} as const;
