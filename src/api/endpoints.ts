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

  courses: {
    list: '/courses',
    detail: (id: string) => `/courses/${id}`,
    sections: (id: string) => `/courses/${id}/sections`,
    myCourses: '/courses/mine',
    progress: (id: string) => `/courses/${id}/progress`,
    enroll: (id: string) => `/courses/${id}/enroll`,
    redeemCode: (id: string) => `/courses/${id}/redeem`,
    attachments: (id: string) => `/courses/${id}/attachments`,
    /**
     * The parts of a course and what the student already holds.
     *
     * `hasParts: false` means the course is sold whole — a legitimate answer,
     * not a failure.
     */
    parts: (id: string) => `/courses/${id}/parts`,
  },

  courseParts: {
    /** Parts the student holds, with the value frozen at acquisition. */
    myPurchases: '/me/part-purchases',
  },

  codes: {
    /**
     * POST — checks a card without consuming it, so the student can see what
     * it unlocks before committing. Unknown and expired cards answer
     * identically, so this cannot be used to hunt for valid codes.
     */
    validate: '/codes/validate',
  },

  /**
   * Wallet credit exists for the Library and nothing else.
   *
   * No course and no course part ever debits it — those are unlocked by access
   * cards, paid for offline. There is deliberately no wallet call anywhere in
   * the course flow.
   */
  wallet: {
    summary: '/wallet',
    transactions: '/wallet/transactions',
    /** Redeems a recharge card. The credit comes from the card, not the body. */
    redeem: '/wallet/redeem',
  },

  library: {
    materials: '/library/materials',
    material: (id: string) => `/library/materials/${id}`,
    mine: '/library/me',
    myPurchases: '/library/me/purchases',
    /** Prices an item without buying it: balance, shortfall, overlap. */
    quote: '/library/quote',
    purchase: '/library/purchase',
    /**
     * POST — a short-lived signed URL bound to the reader, plus the watermark
     * to render over it. The storage key is never sent to the client.
     */
    open: (partId: string) => `/library/parts/${partId}/open`,
  },

  support: {
    tickets: '/support/tickets',
    ticket: (id: string) => `/support/tickets/${id}`,
    reply: (id: string) => `/support/tickets/${id}/messages`,
  },

  storage: {
    /**
     * POST — presigns an avatar upload and returns the object key. The bytes
     * are PUT straight to storage; this API never accepts image bytes.
     */
    avatarUpload: '/storage/uploads/avatar',
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
