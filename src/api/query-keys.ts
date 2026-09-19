/**
 * Centralised TanStack Query keys.
 *
 * Hierarchical arrays so `invalidateQueries({ queryKey: qk.courses.all })`
 * nukes every course-derived cache entry in one call.
 */
export const qk = {
  auth: {
    all: ['auth'] as const,
    me: () => [...qk.auth.all, 'me'] as const,
    session: () => [...qk.auth.all, 'session'] as const,
  },

  catalog: {
    all: ['catalog'] as const,
    universities: () => [...qk.catalog.all, 'universities'] as const,
    faculties: (universityId: string) =>
      [...qk.catalog.all, 'faculties', universityId] as const,
    departments: (facultyId: string) =>
      [...qk.catalog.all, 'departments', facultyId] as const,
    academicYears: () => [...qk.catalog.all, 'academic-years'] as const,
  },

  home: {
    all: ['home'] as const,
    feed: () => [...qk.home.all, 'feed'] as const,
  },

  /**
   * Promotional banners.
   *
   * There is no `/ads` endpoint — the backend has no advertisement concept at
   * all. Banners are derived from the home feed's announcements, so the key
   * stays here only to scope the derived selector; nothing fetches it.
   */
  promos: {
    all: ['promos'] as const,
    list: (placement: string) => [...qk.promos.all, 'list', placement] as const,
  },

  courses: {
    all: ['courses'] as const,
    list: (filters: object) => [...qk.courses.all, 'list', filters] as const,
    detail: (id: string) => [...qk.courses.all, 'detail', id] as const,
    mine: (filters: object) => [...qk.courses.all, 'mine', filters] as const,
    progress: (id: string) => [...qk.courses.all, 'progress', id] as const,
    /** Nested under the course so redeeming a card invalidates both at once. */
    parts: (id: string) => [...qk.courses.all, 'parts', id] as const,
    myParts: (filters: object) => [...qk.courses.all, 'my-parts', filters] as const,
  },

  lessons: {
    all: ['lessons'] as const,
    detail: (id: string) => [...qk.lessons.all, 'detail', id] as const,
    byVideo: (videoId: string) => [...qk.lessons.all, 'by-video', videoId] as const,
  },

  playback: {
    all: ['playback'] as const,
    ticket: (videoId: string) => [...qk.playback.all, 'ticket', videoId] as const,
  },

  attachments: {
    all: ['attachments'] as const,
    ticket: (id: string) => [...qk.attachments.all, 'ticket', id] as const,
  },

  progress: {
    all: ['progress'] as const,
    continueWatching: () => [...qk.progress.all, 'continue-watching'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: (filters: object) => [...qk.notifications.all, 'list', filters] as const,
    unread: () => [...qk.notifications.all, 'unread-count'] as const,
    preferences: () => [...qk.notifications.all, 'preferences'] as const,
  },

  search: {
    all: ['search'] as const,
    query: (q: string, entity?: string) =>
      [...qk.search.all, 'query', q, entity ?? 'all'] as const,
    suggestions: (q: string) => [...qk.search.all, 'suggestions', q] as const,
  },

  devices: {
    all: ['devices'] as const,
    list: () => [...qk.devices.all, 'list'] as const,
  },

  wallet: {
    all: ['wallet'] as const,
    summary: () => [...qk.wallet.all, 'summary'] as const,
    transactions: (filters: object) =>
      [...qk.wallet.all, 'transactions', filters] as const,
  },

  library: {
    all: ['library'] as const,
    browse: (filters: object) => [...qk.library.all, 'browse', filters] as const,
    material: (id: string) => [...qk.library.all, 'material', id] as const,
    mine: (filters: object) => [...qk.library.all, 'mine', filters] as const,
    purchases: (filters: object) => [...qk.library.all, 'purchases', filters] as const,
    /**
     * A reading ticket is never cached: it expires, and it is bound to one
     * device and session. The key exists so an in-flight request can be
     * cancelled, not so its result can be reused.
     */
    document: (partId: string) => [...qk.library.all, 'document', partId] as const,
  },

  support: {
    all: ['support'] as const,
    tickets: (filters: object) => [...qk.support.all, 'tickets', filters] as const,
    ticket: (id: string) => [...qk.support.all, 'ticket', id] as const,
  },
} as const;
