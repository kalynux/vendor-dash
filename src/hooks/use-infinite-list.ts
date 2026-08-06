import * as React from 'react';
import { getListCache, setListCache, clearListCache } from '@/lib/listCache';
import { apiErrorMessage } from '@/i18n';

export interface InfinitePage<T> {
  items: T[];
  total: number;
  totalPages: number;
}

interface CachedList<T> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
}

export interface UseInfiniteListOptions<T> {
  /** Fetches one page. `page` is 1-based; `limit` is the per-page size. */
  fetchPage: (page: number, limit: number) => Promise<InfinitePage<T>>;
  /**
   * Approximate rendered height (px) of one row/card. Used to derive a page
   * size large enough that the first load exceeds the viewport height.
   */
  rowHeight?: number;
  /** Minimum page size, regardless of viewport. */
  minLimit?: number;
  /** Extra rows fetched beyond what fills the viewport. */
  buffer?: number;
  /**
   * When any value here changes, the list resets to page 1 and refetches.
   * Use for search/filter/sort state.
   */
  deps?: React.DependencyList;
  /** When false, the hook stays idle (e.g. only run on mobile). Default true. */
  enabled?: boolean;
  /**
   * When set, accumulated pages are cached under this key and restored on the
   * next mount (skipping the initial fetch), so returning to the list after a
   * tab switch / route round-trip doesn't reload. Cleared when `deps` change.
   */
  cacheKey?: string;
}

export interface UseInfiniteListResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** Attach to a sentinel element at the bottom of the list. */
  sentinelRef: (node: Element | null) => void;
  /** Reset to page 1 and refetch. */
  reload: () => void;
}

/**
 * Generic infinite-scroll list driver for page+limit APIs.
 *
 * Computes a single per-mount page size from the viewport height so every page
 * (including the first) is tall enough to scroll, then accumulates pages as a
 * bottom sentinel enters view via IntersectionObserver.
 */
export function useInfiniteList<T>({
  fetchPage,
  rowHeight = 72,
  minLimit = 15,
  buffer = 4,
  deps = [],
  enabled = true,
  cacheKey,
}: UseInfiniteListOptions<T>): UseInfiniteListResult<T> {
  const limit = React.useMemo(() => {
    if (typeof window === 'undefined') return minLimit;
    const fit = Math.ceil(window.innerHeight / rowHeight) + buffer;
    return Math.max(minLimit, fit);
  }, [rowHeight, minLimit, buffer]);

  // Read any cached page set once, to hydrate initial state and skip the first fetch.
  const hydrationRef = React.useRef<CachedList<T> | null>(
    cacheKey ? getListCache<CachedList<T>>(cacheKey) ?? null : null,
  );

  const [items, setItems] = React.useState<T[]>(hydrationRef.current?.items ?? []);
  const [total, setTotal] = React.useState(hydrationRef.current?.total ?? 0);
  const [page, setPage] = React.useState(hydrationRef.current?.page ?? 1);
  const [totalPages, setTotalPages] = React.useState(hydrationRef.current?.totalPages ?? 1);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Keep the latest fetcher without making it a fetch dependency.
  const fetchRef = React.useRef(fetchPage);
  fetchRef.current = fetchPage;

  // Guards against overlapping/stale requests.
  const requestId = React.useRef(0);
  const inFlight = React.useRef(false);

  const loadPage = React.useCallback(
    async (target: number, mode: 'replace' | 'append') => {
      if (!enabled || inFlight.current) return;
      inFlight.current = true;
      const id = ++requestId.current;
      if (mode === 'replace') setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await fetchRef.current(target, limit);
        if (id !== requestId.current) return; // superseded by a newer request
        setItems((prev) => (mode === 'append' ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setPage(target);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(apiErrorMessage(err, { fallbackKey: 'common.states.errorDescription' }));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
        inFlight.current = false;
      }
    },
    [enabled, limit],
  );

  const reload = React.useCallback(() => {
    setItems([]);
    setPage(1);
    loadPage(1, 'replace');
  }, [loadPage]);

  // Reset + load whenever deps (filters/search) or enabled/limit change.
  // On the first enabled run, skip the fetch if we hydrated from cache.
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (!enabled) return;
    if (!didInit.current) {
      didInit.current = true;
      if (hydrationRef.current) return; // restored from cache → no initial fetch
      loadPage(1, 'replace');
      return;
    }
    // deps changed (filters/search) → drop any cache and refetch from page 1.
    if (cacheKey) clearListCache(cacheKey);
    setItems([]);
    setPage(1);
    loadPage(1, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, limit, ...deps]);

  // Persist the accumulated pages so a remount can restore them.
  React.useEffect(() => {
    if (!cacheKey || !enabled) return;
    setListCache<CachedList<T>>(cacheKey, { items, page, total, totalPages });
  }, [cacheKey, enabled, items, page, total, totalPages]);

  const hasMore = page < totalPages;

  // IntersectionObserver sentinel.
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const hasMoreRef = React.useRef(hasMore);
  hasMoreRef.current = hasMore;
  const pageRef = React.useRef(page);
  pageRef.current = page;

  const sentinelRef = React.useCallback(
    (node: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node || !enabled) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0]?.isIntersecting &&
            hasMoreRef.current &&
            !inFlight.current
          ) {
            loadPage(pageRef.current + 1, 'append');
          }
        },
        { rootMargin: '200px' },
      );
      observerRef.current.observe(node);
    },
    [enabled, loadPage],
  );

  React.useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  return {
    items,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    sentinelRef,
    reload,
  };
}
