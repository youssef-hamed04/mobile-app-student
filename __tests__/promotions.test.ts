import { announcementToBanner } from '@/features/ads/api';
import { resolveAdTarget } from '@/features/ads/target';
import type { AppNotification } from '@/types/domain';

/**
 * Promotional banners, now derived from announcements.
 *
 * The `/ads` endpoint never existed on this backend, so the carousel is fed
 * from the home feed's announcements instead. Two things must hold for that
 * substitution to be safe rather than merely convenient:
 *
 *  - An announcement with no artwork cannot become a banner. The carousel is an
 *    image component; a title-only banner would render as an empty box.
 *  - An announcement's `route` is admin-authored, so it goes through the same
 *    destination validation every other banner target does. It must not become
 *    a trusted route just because it arrived on the feed.
 */

const announcement = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  kind: 'ANNOUNCEMENT',
  title: 'Mid-term timetable',
  body: 'Published for every year.',
  read: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  route: null,
  imageUrl: 'https://cdn.example.test/banner.png',
  ...over,
});

describe('announcementToBanner', () => {
  it('carries the announcement across as a banner', () => {
    const banner = announcementToBanner(announcement(), 0);

    expect(banner).toMatchObject({
      id: 'n1',
      imageUrl: 'https://cdn.example.test/banner.png',
      title: 'Mid-term timetable',
      description: 'Published for every year.',
      displayOrder: 0,
    });
  });

  it('skips an announcement with no artwork', () => {
    expect(announcementToBanner(announcement({ imageUrl: null }), 0)).toBeNull();
  });

  it('is inert when the announcement has no route', () => {
    const banner = announcementToBanner(announcement({ route: null }), 0);

    expect(banner?.target.type).toBe('NONE');
    expect(resolveAdTarget(banner!.target)).toBeNull();
  });

  it('routes an in-app path through the existing destination check', () => {
    const banner = announcementToBanner(announcement({ route: '/course/c1' }), 0);

    expect(resolveAdTarget(banner!.target)).toEqual({
      kind: 'internal',
      href: '/course/c1',
    });
  });

  /**
   * The reason the route is not simply trusted: an announcement is authored in
   * the dashboard, and `//evil.com` is an absolute URL wearing a path's
   * clothing.
   */
  it.each(['//evil.com', 'https://evil.com', 'javascript:alert(1)'])(
    'renders inert rather than navigating to %s',
    (route) => {
      const banner = announcementToBanner(announcement({ route }), 0);
      expect(resolveAdTarget(banner!.target)).toBeNull();
    }
  );

  it('preserves the order the feed returned', () => {
    const banners = [announcement({ id: 'a' }), announcement({ id: 'b' })]
      .map((a, i) => announcementToBanner(a, i))
      .filter(Boolean);

    expect(banners.map((b) => b!.displayOrder)).toEqual([0, 1]);
  });

  /**
   * Scheduling and audience are enforced before delivery, so a delivered
   * announcement is one the student is meant to see now. Carrying a window
   * here would invite the carousel to re-filter on stale clocks.
   */
  it('carries no client-side schedule window', () => {
    const banner = announcementToBanner(announcement(), 0);

    expect(banner?.startsAt).toBeNull();
    expect(banner?.endsAt).toBeNull();
  });
});
