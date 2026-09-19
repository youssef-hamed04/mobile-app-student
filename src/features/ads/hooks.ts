import { useMemo } from 'react';

import { useHomeFeed } from '@/features/courses/hooks';
import type { Advertisement } from '@/types/domain';

import { type AdPlacement, announcementToBanner } from './api';

/**
 * Banners for a placement.
 *
 * Derived from the home feed rather than fetched. There is no `/ads` endpoint
 * to fetch from, and announcements already arrive with the feed — so the
 * carousel costs no extra request, cannot fail independently of the screen it
 * sits on, and cannot be slower than the content beside it.
 *
 * That is a change in kind from the previous implementation, which gave the
 * banner its own query precisely so it could fail alone. With no endpoint
 * behind it, a separate query bought nothing but a guaranteed 404.
 *
 * The return shape is kept query-like — `{ data, isLoading, isError }` — so the
 * carousel, which renders a skeleton while loading and nothing on error, did
 * not have to change.
 */
export function useAdvertisements(_placement: AdPlacement = 'HOME') {
  const feed = useHomeFeed();

  const data = useMemo<Advertisement[] | undefined>(() => {
    if (!feed.data) return undefined;

    return feed.data.announcements
      .map((announcement, index) => announcementToBanner(announcement, index))
      .filter((banner): banner is Advertisement => banner !== null)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [feed.data]);

  return {
    data,
    isLoading: feed.isLoading,
    isError: feed.isError,
  };
}
