import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { EarningsPage, EarningsPageMeta } from '@/types/earnings.types';
import { earningsErrorMessage } from './earnings.constants';

const PAGE_SIZE = 10;

/** First page on mount, then "Load more" appends the next one. */
export function usePagedList<T>(fetchPage: (page: number, limit: number) => Promise<EarningsPage<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<EarningsPageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPage(1, PAGE_SIZE);
      setItems(res.items);
      setMeta(res.meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!meta) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(meta.page + 1, PAGE_SIZE);
      setItems((prev) => [...prev, ...res.items]);
      setMeta(res.meta);
    } catch (err) {
      toast.error(earningsErrorMessage(err, 'account.earnings.adjustments.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, meta]);

  const hasMore = !!meta && meta.page < meta.pages;
  return { items, loading, loadingMore, error, hasMore, load, loadMore };
}
