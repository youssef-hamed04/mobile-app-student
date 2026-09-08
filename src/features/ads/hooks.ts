import { useQuery } from '@tanstack/react-query';

import { qk } from '@/api/query-keys';
import type { Advertisement } from '@/types/domain';

import { type AdPlacement, adsApi } from './api';

/** Promotions change on an editorial cadence, not a per-session one. */
const STALE_TIME = 10 * 60_000;

/**
 * Advertisements for a placement.
 *
 * Deliberately its own query rather than part of the home feed: a promotion
 * failing or being slow must never delay or break the course content next to
 * it, and giving it a separate cache entry means a banner refresh doesn't
 * invalidate the student's courses.
 *
 * `retry: 1` and a long `staleTime` keep a decorative surface from generating
 * meaningful network traffic on a student's mobile data.
 */
export function useAdvertisements(placement: AdPlacement = 'HOME') {
  return useQuery({
    queryKey: qk.ads.list(placement),
    queryFn: ({ signal }) => adsApi.list(placement, signal),
    staleTime: STALE_TIME,
    gcTime: 30 * 60_000,
    retry: 1,
    select: selectDisplayable,
  });
}

/**
 * Server-side scheduling is authoritative — this is a second pass over what
 * came back, not a substitute for it.
 *
 * It earns its place because query results are persisted to disk: without it,
 * a student who opens the app offline can be shown a campaign that expired
 * while they were away.
 */
function selectDisplayable(ads: Advertisement[]): Advertisement[] {
  const now = Date.now();

  return [...ads]
    .filter((ad) => {
      if (!ad.imageUrl) return false;
      if (ad.startsAt && Date.parse(ad.startsAt) > now) return false;
      if (ad.endsAt && Date.parse(ad.endsAt) < now) return false;
      return true;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
