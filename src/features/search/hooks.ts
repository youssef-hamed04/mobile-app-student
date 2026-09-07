import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { qk } from '@/api/query-keys';
import { MAX_RECENT_SEARCHES, SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from '@/constants';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { KvKeys, kvJson } from '@/services/kv';
import type { SearchEntity, SearchResultGroup } from '@/types/domain';

export function useSearch(term: string, entity?: SearchEntity) {
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debouncedTerm.length >= SEARCH_MIN_CHARS;

  const query = useQuery({
    queryKey: qk.search.query(debouncedTerm, entity),
    queryFn: ({ signal }) =>
      api.get<SearchResultGroup[]>(
        Endpoints.search.query,
        { q: debouncedTerm, entity },
        { signal }
      ),
    enabled,
    // Search results go stale fast and are cheap to refetch; keeping them
    // around briefly makes back-navigation instant without showing stale data.
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  return { query, debouncedTerm, enabled };
}

/** Recent searches, persisted in MMKV (non-sensitive, device-local). */
export function useRecentSearches() {
  const [recents, setRecents] = React.useState<string[]>(() =>
    kvJson.get<string[]>(KvKeys.recentSearches, [])
  );

  const addRecent = React.useCallback((term: string) => {
    const clean = term.trim();
    if (clean.length < SEARCH_MIN_CHARS) return;

    setRecents((prev) => {
      const next = [clean, ...prev.filter((r) => r !== clean)].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      kvJson.set(KvKeys.recentSearches, next);
      return next;
    });
  }, []);

  const clearRecents = React.useCallback(() => {
    kvJson.remove(KvKeys.recentSearches);
    setRecents([]);
  }, []);

  return { recents, addRecent, clearRecents };
}
