import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { Advertisement } from '@/types/domain';

/**
 * Where a promotion is being rendered.
 *
 * Sent to the server as a filter so a second surface (the catalogue, say) can
 * be added later without a new endpoint or a client-side split.
 */
export type AdPlacement = 'HOME';

export const adsApi = {
  list: (placement: AdPlacement, signal?: AbortSignal) =>
    api.get<Advertisement[]>(Endpoints.ads.list, { placement }, { signal }),
};
