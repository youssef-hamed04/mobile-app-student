import type { Advertisement, AppNotification } from '@/types/domain';

/**
 * Promotional banners.
 *
 * There is no advertisement endpoint. The backend has no advertisement concept
 * at all — no module, no table, no route — so this file used to call a `/ads`
 * path that would have 404'd against every environment. Nothing fetches here
 * now.
 *
 * What the platform does have is announcements: admin-authored messages,
 * audience-targeted and scheduled server-side, delivered with the home feed and
 * carrying an optional image and route. That is the same editorial surface a
 * banner was for, so the carousel is fed from it and the `Advertisement` shape
 * is kept as the component's view model rather than as a second wire format.
 */

/**
 * Where a banner is being rendered.
 *
 * Only the home feed carries announcements today. The parameter is kept so the
 * carousel can be placed elsewhere without changing its signature, and so the
 * component's props do not have to change if a second surface appears.
 */
export type AdPlacement = 'HOME';

/**
 * Turns an announcement into something the carousel can render.
 *
 * Returns null for anything without artwork: the banner is an image component,
 * and an announcement with no image belongs in the notifications list, where it
 * already appears in full.
 *
 * `route` is admin-authored and therefore untrusted. It is passed through as an
 * `APP_SCREEN` target so that `resolveAdTarget` applies the same checks it
 * applies to everything else — a banner whose destination fails validation
 * renders inert rather than navigating somewhere unintended.
 */
export function announcementToBanner(
  announcement: AppNotification,
  index: number
): Advertisement | null {
  if (!announcement.imageUrl) return null;

  return {
    id: announcement.id,
    imageUrl: announcement.imageUrl,
    // Unknown: announcements carry no authored ratio. The carousel falls back
    // to its own default box rather than reserving a wrong one.
    aspectRatio: null,
    title: announcement.title,
    description: announcement.body,
    ctaLabel: null,
    target: announcement.route
      ? { type: 'APP_SCREEN', entityId: null, url: announcement.route }
      : { type: 'NONE', entityId: null, url: null },
    // The server already returns announcements newest-first; the index
    // preserves that order through the carousel's own sort.
    displayOrder: index,
    // Scheduling and audience are enforced server-side before delivery, so a
    // delivered announcement is one the student is meant to see now. There is
    // no client-side window to re-check.
    startsAt: null,
    endsAt: null,
  };
}
