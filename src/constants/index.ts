/** Cross-cutting constants. Feature-specific values live with the feature. */

export const PAGE_SIZE = 20;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 350;
export const MAX_RECENT_SEARCHES = 8;

/** Watch progress is flushed at most this often while a video plays. */
export const PROGRESS_FLUSH_INTERVAL_MS = 15_000;
/** …and always when the position moves by more than this. */
export const PROGRESS_FLUSH_DELTA_SECONDS = 20;

/** Refresh a playback ticket this long before it expires. */
export const TICKET_REFRESH_LEAD_SECONDS = 45;

/** Player chrome auto-hides after this idle period. */
export const CONTROLS_HIDE_DELAY_MS = 3500;

export const SEEK_STEP_SECONDS = 10;

/** Resume prompt only appears past this offset (avoids nagging at 0:03). */
export const RESUME_PROMPT_MIN_SECONDS = 20;
/** …and not within this many seconds of the end. */
export const RESUME_IGNORE_TAIL_SECONDS = 15;

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_NAME_PARTS = 3;

export const SUPPORT_ROUTES = {
  whatsapp: (phone: string, text: string) =>
    `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`,
  tel: (phone: string) => `tel:${phone}`,
  mailto: (email: string, subject: string) =>
    `mailto:${email}?subject=${encodeURIComponent(subject)}`,
} as const;
