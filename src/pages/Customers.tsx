import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Tag, ChevronRight, Loader2, ShoppingBag,
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
  SearchFilterBar,
} from '@/components/filters';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { getListCache, setListCache } from '@/lib/listCache';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { MobileListFooter } from '@/components/layout/MobileListFooter';
import { CustomerAvatar } from '@/components/customers/CustomerAvatar';
import { FlagBadge, FlagDot } from '@/components/customers/FlagBadge';
import { CustomerDetailSheet } from '@/components/customers/CustomerDetailSheet';
import { FlagsManagerSheet } from '@/components/customers/FlagsManagerSheet';
import { CUSTOMER_SORT_OPTIONS, relativeTime } from '@/components/customers/customer.constants';
import { fetchCustomers, fetchFlags } from '@/services/customers.service';
import { useTranslation, useFormatters, useApiError } from '@/i18n';
import type {
  CustomerListItem, CustomerListMeta, CustomerDetail, CustomerFlag, CustomersQueryParams,
} from '@/types/customers.types';

const PAGE_LIMIT = 20;

const CUSTOMERS_DESKTOP_KEY = 'customers-desktop';
interface CustomersDesktopCache {
  customers: CustomerListItem[];
  meta: CustomerListMeta | null;
  searchQuery: string;
  debouncedSearch: string;
  flagFilter: string;
  sort: string;
  page: number;
}

export function Customers() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const dCache = getListCache<CustomersDesktopCache>(CUSTOMERS_DESKTOP_KEY);
  const [customers, setCustomers] = useState<CustomerListItem[]>(dCache?.customers ?? []);
  const [meta, setMeta] = useState<CustomerListMeta | null>(dCache?.meta ?? null);
  const [loading, setLoading] = useState(!dCache);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(dCache?.searchQuery ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(dCache?.debouncedSearch ?? '');
  const [flagFilter, setFlagFilter] = useState(dCache?.flagFilter ?? '');
  const [sort, setSort] = useState(dCache?.sort ?? CUSTOMER_SORT_OPTIONS[0].value);
  const [page, setPage] = useState(dCache?.page ?? 1);

  const [flags, setFlags] = useState<CustomerFlag[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [flagsManagerOpen, setFlagsManagerOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Local overrides applied after an in-detail edit, so both the desktop list and
  // the mobile infinite list reflect name/flag/stat changes without a full reload.
  const [overrides, setOverrides] = useState<Record<string, CustomerDetail>>({});

  const isMobile = useIsMobile();

  const sortConfig = useMemo(
    () => CUSTOMER_SORT_OPTIONS.find((s) => s.value === sort) ?? CUSTOMER_SORT_OPTIONS[0],
    [sort],
  );

  // Flags are fetched once and shared with the filter, detail picker and manager.
  const loadFlags = useCallback(() => {
    fetchFlags().then(setFlags).catch(() => setFlags([]));
  }, []);
  useEffect(() => { loadFlags(); }, [loadFlags]);

  const load = useCallback(async (params: CustomersQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCustomers({ limit: PAGE_LIMIT, ...params });
      setCustomers(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'customers.errors.loadFailed' }));
      setCustomers([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  // Debounce the search box; reset to page 1. Skip first run so a restored value
  // doesn't reset paging on return.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDidInit = useRef(false);
  useEffect(() => {
    if (!searchDidInit.current) {
      searchDidInit.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const queryParams: CustomersQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    flagId: flagFilter || undefined,
    sortBy: sortConfig.sortBy,
    sortOrder: sortConfig.sortOrder,
    page,
  }), [debouncedSearch, flagFilter, sortConfig, page]);

  // Desktop: page-based. Skip first load if restored from cache.
  const desktopInit = useRef(false);
  useEffect(() => {
    if (isMobile) return;
    if (!desktopInit.current) {
      desktopInit.current = true;
      if (dCache) return;
    }
    load(queryParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, queryParams, isMobile]);

  // Persist desktop list + filters for restore on remount.
  useEffect(() => {
    if (isMobile) return;
    setListCache<CustomersDesktopCache>(CUSTOMERS_DESKTOP_KEY, {
      customers, meta, searchQuery, debouncedSearch, flagFilter, sort, page,
    });
  }, [isMobile, customers, meta, searchQuery, debouncedSearch, flagFilter, sort, page]);

  useScrollRestoration('customers');

  // ── Mobile infinite scroll ──────────────────────────────────────────────────
  const fetchCustomersPage = useCallback(
    (pageArg: number, limit: number) =>
      fetchCustomers({
        search: debouncedSearch || undefined,
        flagId: flagFilter || undefined,
        sortBy: sortConfig.sortBy,
        sortOrder: sortConfig.sortOrder,
        page: pageArg,
        limit,
      }).then((r) => ({ items: r.data, total: r.meta.total, totalPages: r.meta.pages })),
    [debouncedSearch, flagFilter, sortConfig],
  );

  const infinite = useInfiniteList<CustomerListItem>({
    fetchPage: fetchCustomersPage,
    rowHeight: 76,
    enabled: isMobile,
    deps: [debouncedSearch, flagFilter, sort],
    cacheKey: 'customers',
  });

  // Apply any in-session overrides (after a detail edit) onto a list row.
  const applyOverride = useCallback(
    (item: CustomerListItem): CustomerListItem => {
      const o = overrides[item.customerId];
      if (!o) return item;
      return {
        ...item,
        displayName: o.displayName,
        realName: o.realName,
        hasNameOverride: o.hasNameOverride,
        flags: o.flags,
        orderCount: o.orderCount,
        totalSpent: o.totalSpent,
        lastOrderAt: o.lastOrderAt,
      };
    },
    [overrides],
  );

  const handleDetailUpdated = useCallback((detail: CustomerDetail) => {
    setOverrides((prev) => ({ ...prev, [detail.customerId]: detail }));
  }, []);

  const handleFlagsChanged = useCallback(() => {
    loadFlags();
    // A flag rename/delete can change rows + the active filter target; refresh both lists.
    if (isMobile) infinite.reload();
    else load(queryParams);
    setOverrides({});
  }, [loadFlags, isMobile, infinite, load, queryParams]);

  function clearFilters() {
    setSearchQuery('');
    setFlagFilter('');
    setSort(CUSTOMER_SORT_OPTIONS[0].value);
    setPage(1);
  }

  const hasActiveQuery = !!flagFilter || searchQuery.trim().length > 0;
  const activeFlag = flags.find((f) => f.id === flagFilter) ?? null;
  const defaultSort = CUSTOMER_SORT_OPTIONS[0].value;
  const activeFilterCount = (flagFilter ? 1 : 0) + (sort !== defaultSort ? 1 : 0);

  // ── Shared search + filter UI (desktop layout and mobile subheader) ──────────
  const filtersNode = (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('customers.list.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel={t('customers.list.filterTitle')}
      />
      <ActiveFilterChips
        chips={[
          ...(activeFlag
            ? [{
              key: 'flag',
              label: t('customers.list.flagChip', { value: activeFlag.name }),
              onRemove: () => { setFlagFilter(''); setPage(1); },
            }]
            : []),
          ...(sort !== defaultSort
            ? [{
              key: 'sort',
              label: t('customers.list.sortChip', { value: t(sortConfig.labelKey) }),
              onRemove: () => { setSort(defaultSort); setPage(1); },
            }]
            : []),
        ]}
        onClearAll={clearFilters}
      />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('customers.list.filterTitle')}
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel={t('customers.list.applyFilters')}
    >
      <FilterSection title={t('customers.list.flagSection')}>
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('customers.list.noFlagsYet')}
          </p>
        ) : (
          <FilterChips
            options={flags.map((flag) => ({
              value: flag.id,
              label: flag.name,
              icon: <FlagDot color={flag.color} />,
            }))}
            value={flagFilter || undefined}
            onChange={(v) => { setFlagFilter(v ?? ''); setPage(1); }}
            allLabel={t('customers.list.allFlags')}
          />
        )}
      </FilterSection>

      <FilterSection title={t('customers.list.sortSection')}>
        <FilterChips
          options={CUSTOMER_SORT_OPTIONS.map((o) => ({ value: o.value, labelKey: o.labelKey }))}
          value={sort}
          onChange={(v) => { setSort(v ?? defaultSort); setPage(1); }}
          hideAll
        />
      </FilterSection>
    </FilterSheet>
  );

  const emptyNode = (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Users className="h-6 w-6" /></EmptyMedia>
        <EmptyTitle>
          {hasActiveQuery
            ? t('customers.list.emptyFilteredTitle')
            : t('customers.list.emptyTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {hasActiveQuery
            ? t('customers.list.emptyFilteredDescription')
            : t('customers.list.emptyDescription')}
        </EmptyDescription>
      </EmptyHeader>
      {hasActiveQuery && (
        <EmptyContent>
          <Button variant="outline" onClick={clearFilters}>{t('common.actions.clearAll')}</Button>
        </EmptyContent>
      )}
    </Empty>
  );

  const sheets = (
    <>
      {filterSheet}
      <CustomerDetailSheet
        customerId={detailId}
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        availableFlags={flags}
        onUpdated={handleDetailUpdated}
        onManageFlags={() => setFlagsManagerOpen(true)}
      />
      <FlagsManagerSheet
        open={flagsManagerOpen}
        onOpenChange={setFlagsManagerOpen}
        flags={flags}
        onChanged={handleFlagsChanged}
      />
    </>
  );

  const renderMobileRow = (c: CustomerListItem) => {
    const item = applyOverride(c);
    return (
      <button
        key={item.customerId}
        onClick={() => setDetailId(item.customerId)}
        className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <CustomerAvatar name={item.displayName} avatar={item.avatar} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.email ?? t('common.units.orders', { count: item.orderCount })}
          </p>
          {item.flags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.flags.slice(0, 2).map((f) => <FlagBadge key={f.id} flag={f} />)}
              {item.flags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{item.flags.length - 2}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-medium">{fmt.currency(item.totalSpent)}</span>
          <span className="text-xs text-muted-foreground">
            {relativeTime(item.lastOrderAt, t, fmt.date)}
          </span>
        </div>
      </button>
    );
  };

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <MobilePageHeader
          title={t('customers.title')}
          actions={
            <button
              type="button"
              onClick={() => setFlagsManagerOpen(true)}
              aria-label={t('customers.list.manageFlags')}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
            >
              <Tag className="h-5 w-5" />
            </button>
          }
          subheader={filtersNode}
        />

        <div className="pb-28">
          {infinite.loading ? (
            <CustomerListSkeleton mobile />
          ) : infinite.error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{infinite.error}</p>
              <Button variant="outline" size="sm" onClick={infinite.reload}>
                {t('common.actions.retry')}
              </Button>
            </div>
          ) : infinite.items.length === 0 ? (
            emptyNode
          ) : (
            <>
              {infinite.items.map(renderMobileRow)}
              <div ref={infinite.sentinelRef} className="h-1" />
              {infinite.loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>

        <MobileListFooter shown={infinite.items.length} total={infinite.total} nounKey="common.units.customers" />
        {sheets}
      </div>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('customers.title')}</h1>
          <p className="text-muted-foreground">
            {meta ? t('common.units.customers', { count: meta.total }) : t('customers.subtitle')}
          </p>
        </div>
        <Button variant="outline" onClick={() => setFlagsManagerOpen(true)} className="gap-2">
          <Tag className="h-4 w-4" /> {t('customers.list.manageFlags')}
        </Button>
      </div>

      {filtersNode}

      {/* Content */}
      {loading ? (
        <CustomerListSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load(queryParams)}>
            {t('common.actions.retry')}
          </Button>
        </div>
      ) : customers.length === 0 ? (
        emptyNode
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('customers.columns.customer')}</th>
                  <th className="px-4 py-3">{t('customers.columns.flags')}</th>
                  <th className="px-4 py-3 text-right">{t('customers.columns.orders')}</th>
                  <th className="px-4 py-3 text-right">{t('customers.columns.spent')}</th>
                  <th className="px-4 py-3">{t('customers.columns.lastOrder')}</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => {
                  const c = applyOverride(row);
                  return (
                    <tr
                      key={c.customerId}
                      onClick={() => setDetailId(c.customerId)}
                      className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar name={c.displayName} avatar={c.avatar} className="h-9 w-9" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{c.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.email ?? t('common.labels.emptyValue')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.flags.length === 0 ? (
                          <span className="text-muted-foreground">{t('common.labels.emptyValue')}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.flags.slice(0, 3).map((f) => <FlagBadge key={f.id} flag={f} />)}
                            {c.flags.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{c.flags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.orderCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{fmt.currency(c.totalSpent)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {relativeTime(c.lastOrderAt, t, fmt.date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <span>
                {t('common.pagination.showingOf', {
                  shown: customers.length,
                  items: t('customers.list.count', { count: meta.total }),
                })}
              </span>
              {meta.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t('common.pagination.previous')}
                  </Button>
                  <span>{t('common.pagination.pageOf', { page: meta.page, total: meta.pages })}</span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                    {t('common.pagination.next')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {sheets}
    </div>
  );
}

function CustomerListSkeleton({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
