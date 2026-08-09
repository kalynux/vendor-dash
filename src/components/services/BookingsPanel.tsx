import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, List, ChevronRight, Loader2, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia,
} from '@/components/ui/empty';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  FilterTriggerButton,
  SearchFilterBar,
  type ActiveFilterChip,
} from '@/components/filters';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import { fetchBookings } from '@/services/services.service';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/services/StatusBadges';
import { BookingCalendar } from '@/components/services/BookingCalendar';
import { BookingDetailSheet } from '@/components/services/BookingDetailSheet';
import {
  toMajorUnits, BOOKING_STATUS_META, PAYMENT_STATUS_FILTER_KEYS,
} from '@/components/services/service.constants';
import type {
  Booking, BookingListMeta, BookingsQueryParams, BookingStatus, PaymentStatus,
} from '@/types/services.types';

const PAGE_LIMIT = 20;

// `GET /vendor/bookings` takes no free-text parameter (bookings.md → List
// Bookings), so the search field matches in the browser. To keep it from being a
// "filters the twenty rows you can already see" toy, typing a query scans a wide
// window of the vendor's bookings — still honouring the status/payment filters —
// and matches service title, customer email and booking id over that window.
const SEARCH_SCAN_LIMIT = 100; // the endpoint's max page size
const SEARCH_SCAN_PAGES = 5; // …so at most 500 bookings are scanned
const SEARCH_SCAN_MAX = SEARCH_SCAN_LIMIT * SEARCH_SCAN_PAGES;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_OPTIONS: { value: BookingStatus; labelKey: TranslationKey }[] = [
  { value: 'pending', labelKey: BOOKING_STATUS_META.pending.labelKey },
  { value: 'confirmed', labelKey: BOOKING_STATUS_META.confirmed.labelKey },
  { value: 'completed', labelKey: BOOKING_STATUS_META.completed.labelKey },
  { value: 'no-show', labelKey: BOOKING_STATUS_META['no-show'].labelKey },
  { value: 'cancelled', labelKey: BOOKING_STATUS_META.cancelled.labelKey },
];

const PAYMENT_OPTIONS: { value: PaymentStatus; labelKey: TranslationKey }[] = [
  { value: 'unpaid', labelKey: PAYMENT_STATUS_FILTER_KEYS.unpaid },
  { value: 'pending', labelKey: PAYMENT_STATUS_FILTER_KEYS.pending },
  { value: 'paid', labelKey: PAYMENT_STATUS_FILTER_KEYS.paid },
  { value: 'disputed', labelKey: PAYMENT_STATUS_FILTER_KEYS.disputed },
  { value: 'failed', labelKey: PAYMENT_STATUS_FILTER_KEYS.failed },
  { value: 'refunded', labelKey: PAYMENT_STATUS_FILTER_KEYS.refunded },
];

export function BookingsPanel({ openBookingId }: { openBookingId?: string | null } = {}) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const productTitle = (b: Booking): string =>
    typeof b.productId === 'object' ? b.productId.title : t('services.bookings.untitledService');

  const customerEmail = (b: Booking): string =>
    (typeof b.userId === 'object' ? b.userId.login_email : null) ?? t('common.labels.emptyValue');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState<BookingListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<BookingStatus | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | ''>('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  // Bumped after any mutation so list + calendar refetch.
  const [reloadToken, setReloadToken] = useState(0);
  const bump = useCallback(() => setReloadToken((t) => t + 1), []);

  // Deep-link from a notification (`?view=<id>`): open that booking's detail.
  useEffect(() => {
    if (openBookingId) setDetailId(openBookingId);
  }, [openBookingId]);

  // Debounce typing so a scan doesn't fire on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const searching = debouncedSearch.length > 0;

  // Calendar view can't be searched (it renders its own date-ranged fetch), so
  // leaving it holds no stale query behind a field the user can no longer see.
  const changeView = useCallback((next: 'list' | 'calendar') => {
    setView(next);
    if (next === 'calendar') {
      setSearchQuery('');
      setDebouncedSearch('');
    }
  }, []);

  const queryParams: BookingsQueryParams = useMemo(() => ({
    status: statusFilter || undefined,
    paymentStatus: paymentFilter || undefined,
    page,
    limit: PAGE_LIMIT,
  }), [statusFilter, paymentFilter, page]);

  const load = useCallback(async (params: BookingsQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBookings(params);
      setBookings(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'services.errors.loadBookingsFailed' }));
      setBookings([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    if (isMobile || view !== 'list' || searching) return;
    load(queryParams);
  }, [isMobile, view, searching, queryParams, load, reloadToken]);

  // ── Search scan ─────────────────────────────────────────────────────────────
  // Pulls the scan window once per (filters × reload), then re-matches locally as
  // the query changes — so typing another letter costs nothing.
  const searchReqRef = useRef(0);
  const runSearch = useCallback(async () => {
    const reqId = searchReqRef.current + 1;
    searchReqRef.current = reqId;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const collected: Booking[] = [];
      let truncated = false;
      for (let p = 1; p <= SEARCH_SCAN_PAGES; p += 1) {
        const result = await fetchBookings({
          status: statusFilter || undefined,
          paymentStatus: paymentFilter || undefined,
          page: p,
          limit: SEARCH_SCAN_LIMIT,
        });
        if (reqId !== searchReqRef.current) return; // superseded
        collected.push(...result.data);
        if (p >= result.meta.totalPages) break;
        if (p === SEARCH_SCAN_PAGES) truncated = true;
      }
      setSearchResults(collected);
      setSearchTruncated(truncated);
    } catch (err) {
      if (reqId !== searchReqRef.current) return;
      setSearchError(apiError.resolve(err, { fallbackKey: 'services.errors.loadBookingsFailed' }));
      setSearchResults([]);
      setSearchTruncated(false);
    } finally {
      if (reqId === searchReqRef.current) setSearchLoading(false);
    }
  }, [statusFilter, paymentFilter, apiError]);

  useEffect(() => {
    if (view !== 'list' || !searching) {
      searchReqRef.current += 1; // orphan any in-flight scan
      setSearchResults([]);
      setSearchTruncated(false);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    runSearch();
  }, [searching, view, runSearch, reloadToken]);

  const matches = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return [];
    return searchResults.filter((b) => {
      const title = typeof b.productId === 'object' ? b.productId.title : '';
      const email = typeof b.userId === 'object' ? b.userId.login_email ?? '' : '';
      return (
        title.toLowerCase().includes(q)
        || email.toLowerCase().includes(q)
        || b._id.toLowerCase().includes(q)
      );
    });
  }, [searchResults, debouncedSearch]);

  // Desktop pages over the matches locally. A shrinking result set has to drag
  // the current page back with it, or Prev/Next end up pointing past the end.
  const searchTotalPages = Math.max(1, Math.ceil(matches.length / PAGE_LIMIT));
  useEffect(() => {
    if (searching && page > searchTotalPages) setPage(searchTotalPages);
  }, [searching, page, searchTotalPages]);

  // Mobile infinite list.
  const fetchPage = useCallback(
    (pageArg: number, limit: number) =>
      fetchBookings({
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        page: pageArg,
        limit,
      }).then((r) => ({ items: r.data, total: r.meta.total, totalPages: r.meta.totalPages })),
    [statusFilter, paymentFilter],
  );

  const infinite = useInfiniteList<Booking>({
    fetchPage,
    rowHeight: 80,
    enabled: isMobile && view === 'list' && !searching,
    deps: [statusFilter, paymentFilter, reloadToken],
  });

  // Search is deliberately not counted here — the field shows its own state.
  const activeFilterCount = (statusFilter ? 1 : 0) + (paymentFilter ? 1 : 0);
  const hasActiveQuery = activeFilterCount > 0 || searching;

  const clearFilters = () => {
    setStatusFilter('');
    setPaymentFilter('');
    setPage(1);
  };

  const clearAll = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    clearFilters();
  };

  const filterChips: ActiveFilterChip[] = [];
  if (statusFilter) {
    filterChips.push({
      key: 'status',
      label: t('services.bookings.statusChip', {
        value: t(BOOKING_STATUS_META[statusFilter].labelKey),
      }),
      onRemove: () => { setStatusFilter(''); setPage(1); },
    });
  }
  if (paymentFilter) {
    filterChips.push({
      key: 'payment',
      label: t('services.bookings.paymentChip', {
        value: t(PAYMENT_STATUS_FILTER_KEYS[paymentFilter]),
      }),
      onRemove: () => { setPaymentFilter(''); setPage(1); },
    });
  }

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('services.bookings.filterTitle')}
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel={t('services.bookings.applyFilters')}
    >
      <FilterSection title={t('services.bookings.statusSection')}>
        <FilterChips
          options={STATUS_OPTIONS}
          value={statusFilter || undefined}
          onChange={(v) => { setStatusFilter(v ?? ''); setPage(1); }}
          allLabel={t('services.bookings.anyStatus')}
        />
      </FilterSection>
      <FilterSection title={t('services.bookings.paymentSection')}>
        <FilterChips
          options={PAYMENT_OPTIONS}
          value={paymentFilter || undefined}
          onChange={(v) => { setPaymentFilter(v ?? ''); setPage(1); }}
          allLabel={t('services.bookings.anyPayment')}
        />
      </FilterSection>
    </FilterSheet>
  );

  // Below `md` the two segments collapse to 44px icon-only squares, so the search
  // field still gets the lion's share of a narrow row.
  const viewToggle = (
    <div className="inline-flex h-11 shrink-0 overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => changeView('list')}
        aria-label={t('services.bookings.viewList')}
        aria-pressed={view === 'list'}
        className={cn(
          'flex w-11 items-center justify-center gap-1.5 text-sm transition-colors md:w-auto md:px-3',
          view === 'list' ? 'bg-accent' : 'hover:bg-muted/50',
        )}
      >
        <List className="h-4 w-4" />
        <span className="hidden md:inline">{t('services.bookings.viewList')}</span>
      </button>
      <button
        type="button"
        onClick={() => changeView('calendar')}
        aria-label={t('services.bookings.viewCalendar')}
        aria-pressed={view === 'calendar'}
        className={cn(
          'flex w-11 items-center justify-center gap-1.5 border-l text-sm transition-colors md:w-auto md:px-3',
          view === 'calendar' ? 'bg-accent' : 'hover:bg-muted/50',
        )}
      >
        <CalendarDays className="h-4 w-4" />
        <span className="hidden md:inline">{t('services.bookings.viewCalendar')}</span>
      </button>
    </div>
  );

  const toolbar = (
    <div className="space-y-3">
      {view === 'list' ? (
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t(
            isMobile
              ? 'services.bookings.searchPlaceholderShort'
              : 'services.bookings.searchPlaceholder',
          )}
          activeFilterCount={activeFilterCount}
          onOpenFilters={() => setFilterSheetOpen(true)}
          filterLabel={t('services.bookings.filterTitle')}
          trailing={viewToggle}
        />
      ) : (
        // Calendar view has nothing to search — keep the filter + toggle row only.
        <div className="flex items-center gap-2">
          <FilterTriggerButton
            onClick={() => setFilterSheetOpen(true)}
            activeCount={activeFilterCount}
            label={t('services.bookings.filterTitle')}
          />
          <div className="flex-1" />
          {viewToggle}
        </div>
      )}
      <ActiveFilterChips chips={filterChips} onClearAll={clearFilters} />
    </div>
  );

  const emptyNode = (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarClock className="h-6 w-6" /></EmptyMedia>
        <EmptyTitle>
          {hasActiveQuery
            ? t('services.bookings.emptyFilteredTitle')
            : t('services.bookings.emptyTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {hasActiveQuery
            ? t('services.bookings.emptyFilteredDescription')
            : t('services.bookings.emptyDescription')}
        </EmptyDescription>
      </EmptyHeader>
      {hasActiveQuery && (
        <EmptyContent>
          <Button variant="outline" onClick={clearAll}>{t('common.actions.clearAll')}</Button>
        </EmptyContent>
      )}
    </Empty>
  );

  // Note shown when the scan window capped out — tells the vendor why an older
  // booking they expected isn't in the results, and what to do about it.
  const searchScopeNote = searching && searchTruncated && !searchLoading && !searchError && (
    <p className="px-4 text-xs text-muted-foreground md:px-0">
      {t('services.bookings.searchScopeNote', { count: SEARCH_SCAN_MAX })}
    </p>
  );

  // ── Which list is on screen ─────────────────────────────────────────────────
  // Searching swaps both the source and its loading/error state: desktop keeps
  // paging (client-side over the matches), mobile shows every match at once.
  const searchPage = Math.min(page, searchTotalPages);

  const desktopItems = searching
    ? matches.slice((searchPage - 1) * PAGE_LIMIT, searchPage * PAGE_LIMIT)
    : bookings;
  const desktopLoading = searching ? searchLoading : loading;
  const desktopError = searching ? searchError : error;
  const desktopMeta: BookingListMeta | null = searching
    ? { total: matches.length, page: searchPage, limit: PAGE_LIMIT, totalPages: searchTotalPages }
    : meta;

  const mobileItems = searching ? matches : infinite.items;
  const mobileLoading = searching ? searchLoading : infinite.loading;
  const mobileError = searching ? searchError : infinite.error;
  const retryList = () => (searching ? runSearch() : load(queryParams));

  const renderMobileRow = (b: Booking) => (
    <button
      key={b._id}
      onClick={() => setDetailId(b._id)}
      className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{productTitle(b)}</p>
        <p className="truncate text-xs text-muted-foreground">{customerEmail(b)}</p>
        <p className="truncate text-xs text-muted-foreground">{fmt.dateTime(b.startAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <BookingStatusBadge status={b.status} />
        <span className="text-xs font-medium">
          {fmt.currency(toMajorUnits(b.priceSnapshot), b.currency)}
        </span>
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      {toolbar}
      {filterSheet}

      {view === 'calendar' ? (
        <BookingCalendar onOpenBooking={setDetailId} reloadToken={reloadToken} />
      ) : isMobile ? (
        <div className="-mx-4">
          {mobileLoading ? (
            <ListSkeleton mobile />
          ) : mobileError ? (
            <ErrorState message={mobileError} onRetry={searching ? runSearch : infinite.reload} />
          ) : mobileItems.length === 0 ? (
            <>
              {emptyNode}
              {searchScopeNote}
            </>
          ) : (
            <div>
              {searching && (
                <p className="px-4 pb-2 text-xs text-muted-foreground">
                  {t('services.bookings.count', { count: matches.length })}
                </p>
              )}
              {mobileItems.map(renderMobileRow)}
              {searching ? (
                searchScopeNote && <div className="pt-3">{searchScopeNote}</div>
              ) : (
                <>
                  <div ref={infinite.sentinelRef} className="h-1" />
                  {infinite.loadingMore && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : desktopLoading ? (
        <ListSkeleton />
      ) : desktopError ? (
        <ErrorState message={desktopError} onRetry={retryList} />
      ) : desktopItems.length === 0 ? (
        <>
          {emptyNode}
          {searchScopeNote}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('services.bookings.columns.service')}</th>
                  <th className="px-4 py-3">{t('services.bookings.columns.customer')}</th>
                  <th className="px-4 py-3">{t('services.bookings.columns.when')}</th>
                  <th className="px-4 py-3">{t('services.bookings.columns.status')}</th>
                  <th className="px-4 py-3">{t('services.bookings.columns.payment')}</th>
                  <th className="px-4 py-3 text-right">{t('services.bookings.columns.price')}</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {desktopItems.map((b) => (
                  <tr
                    key={b._id}
                    onClick={() => setDetailId(b._id)}
                    className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{productTitle(b)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customerEmail(b)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmt.dateTime(b.startAt)}</td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={b.paymentStatus} /></td>
                    <td className="px-4 py-3 text-right font-medium">
                      {fmt.currency(toMajorUnits(b.priceSnapshot), b.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {desktopMeta && (
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <span>
                {t('common.pagination.showingOf', {
                  shown: desktopItems.length,
                  items: t('services.bookings.count', { count: desktopMeta.total }),
                })}
              </span>
              {desktopMeta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={desktopMeta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t('common.pagination.previous')}
                  </Button>
                  <span>{t('common.pagination.pageOf', { page: desktopMeta.page, total: desktopMeta.totalPages })}</span>
                  <Button variant="outline" size="sm" disabled={desktopMeta.page >= desktopMeta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    {t('common.pagination.next')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {searchScopeNote}
        </>
      )}

      <BookingDetailSheet
        bookingId={detailId}
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        onChanged={bump}
      />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>{t('common.actions.retry')}</Button>
    </div>
  );
}

function ListSkeleton({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
