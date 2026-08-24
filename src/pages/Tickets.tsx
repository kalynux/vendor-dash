import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Ticket as TicketIcon, ChevronRight,
  ShoppingCart, Package, Calendar, User, Store, Truck, Tag, HelpCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia,
} from '@/components/ui/empty';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ActiveFilterChips,
  FilterChips,
  FilterField,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
  type ActiveFilterChip,
} from '@/components/filters';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { getListCache, setListCache } from '@/lib/listCache';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { MobileListFooter } from '@/components/layout/MobileListFooter';
import { CreateTicketSheet } from '@/components/tickets/CreateTicketSheet';
import { TicketDetailSheet } from '@/components/tickets/TicketDetailSheet';
import { FaqSheet } from '@/components/tickets/FaqSheet';
import {
  STATUS_LABEL_KEYS, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, STATUS_TABS,
  PRIORITY_LABEL_KEYS, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  TICKET_TYPE_GROUPS, ticketTypeKey, getTypeVisual, shortTicketRef, relativeTime,
} from '@/components/tickets/ticket.constants';
import { fetchTickets } from '@/services/tickets.service';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import type {
  ApiTicketListItem, TicketListMeta, TicketsQueryParams,
  TicketStatus, TicketPriority, TicketType, UpdatablePriority,
  TicketEntityRef,
} from '@/types/tickets.types';

const PAGE_LIMIT = 20;
const ALL = '__all__';

type SortKey = 'updated' | 'created' | 'priority';
const SORT_OPTIONS: {
  value: SortKey;
  labelKey: TranslationKey;
  sortBy: TicketsQueryParams['sortBy'];
  sortOrder: 'asc' | 'desc';
}[] = [
  { value: 'updated', labelKey: 'tickets.list.sort.updated', sortBy: 'updatedAt', sortOrder: 'desc' },
  { value: 'created', labelKey: 'tickets.list.sort.created', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'priority', labelKey: 'tickets.list.sort.priority', sortBy: 'priority', sortOrder: 'desc' },
];

// Desktop list-state cache so returning to the Tickets tab restores what was
// loaded instead of refetching.
const TICKETS_DESKTOP_KEY = 'tickets-desktop';
interface TicketsDesktopCache {
  tickets: ApiTicketListItem[];
  meta: TicketListMeta | null;
  searchQuery: string;
  debouncedSearch: string;
  statusFilter: TicketStatus | null;
  priorityFilter: UpdatablePriority | '';
  typeFilter: TicketType | '';
  sort: SortKey;
  page: number;
}

export function Tickets() {
  const { t } = useTranslation();
  const apiError = useApiError();
  // The row renderers below bind `t` to a *ticket*, so keep a second, unshadowed
  // reference to the translator for anything called from inside them.
  const translate = t;
  const fmt = useFormatters();
  const dCache = getListCache<TicketsDesktopCache>(TICKETS_DESKTOP_KEY);
  const [tickets, setTickets] = useState<ApiTicketListItem[]>(dCache?.tickets ?? []);
  const [meta, setMeta] = useState<TicketListMeta | null>(dCache?.meta ?? null);
  const [loading, setLoading] = useState(!dCache);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(dCache?.searchQuery ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(dCache?.debouncedSearch ?? '');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(dCache?.statusFilter ?? null);
  const [priorityFilter, setPriorityFilter] = useState<UpdatablePriority | ''>(dCache?.priorityFilter ?? '');
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>(dCache?.typeFilter ?? '');
  const [sort, setSort] = useState<SortKey>(dCache?.sort ?? 'updated');
  const [page, setPage] = useState(dCache?.page ?? 1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const isMobile = useIsMobile();
  const location = useLocation();
  const reactNavigate = useNavigate();

  // Open the create sheet when arrived via a "New Ticket" quick action, or the
  // detail sheet for a specific ticket (e.g. from the Earnings payout-request
  // card), via router state — then clear the state.
  useEffect(() => {
    const state = location.state as { create?: boolean; openTicketId?: string } | null;
    if (state?.create) {
      setCreateOpen(true);
      reactNavigate(location.pathname, { replace: true, state: null });
    } else if (state?.openTicketId) {
      setDetailId(state.openTicketId);
      reactNavigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, reactNavigate]);
  const sortConfig = useMemo(() => SORT_OPTIONS.find((s) => s.value === sort)!, [sort]);

  const load = useCallback(
    async (params: TicketsQueryParams) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchTickets({ limit: PAGE_LIMIT, ...params });
        setTickets(result.data);
        setMeta(result.meta);
      } catch (err) {
        setError(apiError.resolve(err, { fallbackKey: 'tickets.errors.loadFailed' }));
        setTickets([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [apiError],
  );

  // Debounce the raw search box; reset to page 1 on change. Skip the first run
  // so a restored search box doesn't reset paging / trigger a refetch on return.
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const queryParams: TicketsQueryParams = useMemo(() => ({
    q: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    type: typeFilter || undefined,
    sortBy: sortConfig.sortBy,
    sortOrder: sortConfig.sortOrder,
    page,
  }), [debouncedSearch, statusFilter, priorityFilter, typeFilter, sortConfig, page]);

  // Desktop uses page-based pagination; mobile uses infinite scroll below.
  // Skip the first load if we restored a cached list (no reload on return).
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

  // Persist the desktop list + filters so a remount can restore them.
  useEffect(() => {
    if (isMobile) return;
    setListCache<TicketsDesktopCache>(TICKETS_DESKTOP_KEY, {
      tickets, meta, searchQuery, debouncedSearch,
      statusFilter, priorityFilter, typeFilter, sort, page,
    });
  }, [isMobile, tickets, meta, searchQuery, debouncedSearch, statusFilter, priorityFilter, typeFilter, sort, page]);

  useScrollRestoration('tickets');

  const refresh = useCallback(() => load(queryParams), [load, queryParams]);

  // ── Mobile infinite scroll ──────────────────────────────────────────────────
  const fetchTicketsPage = useCallback(
    (pageArg: number, limit: number) =>
      fetchTickets({
        q: debouncedSearch || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        type: typeFilter || undefined,
        sortBy: sortConfig.sortBy,
        sortOrder: sortConfig.sortOrder,
        page: pageArg,
        limit,
      }).then((r) => ({
        items: r.data,
        total: r.meta.total,
        totalPages: r.meta.totalPages,
      })),
    [debouncedSearch, statusFilter, priorityFilter, typeFilter, sortConfig],
  );

  const infinite = useInfiniteList<ApiTicketListItem>({
    fetchPage: fetchTicketsPage,
    rowHeight: 92,
    enabled: isMobile,
    deps: [debouncedSearch, statusFilter, priorityFilter, typeFilter, sort],
    cacheKey: 'tickets',
  });

  const reloadList = useCallback(() => {
    if (isMobile) infinite.reload();
    else { setPage(1); refresh(); }
  }, [isMobile, infinite, refresh]);

  function clearFilters() {
    setStatusFilter(null);
    setPriorityFilter('');
    setTypeFilter('');
    setSearchQuery('');
    setPage(1);
  }

  const hasActiveQuery =
    !!statusFilter || !!priorityFilter || !!typeFilter || searchQuery.trim().length > 0;

  // ── Shared search + filter UI (desktop layout and mobile subheader) ─────────
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (sort !== SORT_OPTIONS[0].value ? 1 : 0);

  const activeChips: ActiveFilterChip[] = [];
  if (statusFilter) {
    activeChips.push({
      key: 'status',
      label: t('tickets.list.chipStatus', { value: t(STATUS_LABEL_KEYS[statusFilter]) }),
      onRemove: () => { setStatusFilter(null); setPage(1); },
    });
  }
  if (typeFilter) {
    activeChips.push({
      key: 'type',
      label: t('tickets.list.chipType', { value: t(ticketTypeKey(typeFilter)) }),
      onRemove: () => { setTypeFilter(''); setPage(1); },
    });
  }
  if (priorityFilter) {
    activeChips.push({
      key: 'priority',
      label: t('tickets.list.chipPriority', { value: t(PRIORITY_LABEL_KEYS[priorityFilter]) }),
      onRemove: () => { setPriorityFilter(''); setPage(1); },
    });
  }
  if (sort !== SORT_OPTIONS[0].value) {
    activeChips.push({
      key: 'sort',
      label: t('tickets.list.chipSort', { value: t(sortConfig.labelKey) }),
      onRemove: () => { setSort(SORT_OPTIONS[0].value); setPage(1); },
    });
  }

  const filtersNode = (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('tickets.list.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel={t('tickets.list.filterTitle')}
      />
      <ActiveFilterChips chips={activeChips} onClearAll={clearFilters} />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('tickets.list.filterTitle')}
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel={t('tickets.list.applyLabel')}
    >
      <FilterSection title={t('tickets.columns.status')}>
        <FilterChips
          options={STATUS_TABS.filter(
            (tab): tab is { labelKey: TranslationKey; value: TicketStatus } => tab.value !== null,
          ).map((tab) => ({ value: tab.value, labelKey: tab.labelKey }))}
          value={statusFilter ?? undefined}
          onChange={(v) => { setStatusFilter((v ?? null) as TicketStatus | null); setPage(1); }}
          allLabel={t('tickets.list.anyStatus')}
        />
      </FilterSection>

      <FilterSection title={t('tickets.columns.priority')}>
        <FilterChips
          options={TICKET_PRIORITIES.map((p) => ({ value: p, labelKey: PRIORITY_LABEL_KEYS[p] }))}
          value={priorityFilter || undefined}
          onChange={(v) => { setPriorityFilter((v ?? '') as UpdatablePriority | ''); setPage(1); }}
          allLabel={t('tickets.list.anyPriority')}
        />
      </FilterSection>

      {/* Type has ~40 values across 8 groups — a grouped select stays scannable
          where a chip wall would not. */}
      <FilterSection title={t('tickets.list.type')}>
        <FilterField>
          <Select
            value={typeFilter || ALL}
            onValueChange={(v) => { setTypeFilter(v === ALL ? '' : (v as TicketType)); setPage(1); }}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue placeholder={t('tickets.list.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('tickets.list.allTypes')}</SelectItem>
              {TICKET_TYPE_GROUPS.map((g) => (
                <SelectGroup key={g.groupLabelKey}>
                  <SelectLabel>{t(g.groupLabelKey)}</SelectLabel>
                  {g.values.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{t(v.labelKey)}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterSection>

      <FilterSection title={t('tickets.list.sortBy')}>
        <FilterChips
          options={SORT_OPTIONS.map((o) => ({ value: o.value, labelKey: o.labelKey }))}
          value={sort}
          onChange={(v) => { setSort(v ?? SORT_OPTIONS[0].value); setPage(1); }}
          hideAll
        />
      </FilterSection>
    </FilterSheet>
  );

  const emptyNode = (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><TicketIcon className="h-6 w-6" /></EmptyMedia>
        <EmptyTitle>{hasActiveQuery ? t('tickets.list.emptyFiltered') : t('tickets.list.empty')}</EmptyTitle>
        <EmptyDescription>
          {hasActiveQuery
            ? t('tickets.list.emptyFilteredHint')
            : t('tickets.list.emptyHint')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasActiveQuery ? (
          <Button variant="outline" onClick={clearFilters}>{t('tickets.list.clearFilters')}</Button>
        ) : (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('tickets.list.newTicket')}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );

  const renderMobileCard = (t: ApiTicketListItem) => (
    <button
      key={t._id}
      onClick={() => setDetailId(t._id)}
      className="flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left"
    >
      <TicketIdentity t={t} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={t.status} />
        <PriorityPill priority={t.priority} locked={t.priority_locked} />
        <span className="ml-auto text-xs text-muted-foreground">{relativeTime(t.updatedAt, translate, fmt.date)}</span>
      </div>
    </button>
  );

  const sheets = (
    <>
      {filterSheet}
      <CreateTicketSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          toast.success(t('tickets.list.added'));
          reloadList();
        }}
      />
      <TicketDetailSheet
        ticketId={detailId}
        open={!!detailId}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
        onUpdated={reloadList}
      />
      <FaqSheet open={faqOpen} onOpenChange={setFaqOpen} />
    </>
  );

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <MobilePageHeader
          title={t('nav.items.tickets')}
          description={t('tickets.subtitle')}
          actions={[
            {
              id: 'new',
              icon: Plus,
              label: t('tickets.list.newTicket'),
              onClick: () => setCreateOpen(true),
            },
            {
              id: 'faq',
              icon: HelpCircle,
              label: t('tickets.faq.title'),
              onClick: () => setFaqOpen(true),
            },
          ]}
          subheader={filtersNode}
        />

        <div className="px-4 pt-3 pb-28">
          {infinite.loading ? (
            <TicketListSkeleton />
          ) : infinite.error ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <TicketIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{infinite.error}</p>
              <Button variant="outline" size="sm" onClick={infinite.reload}>{t('common.actions.retry')}</Button>
            </div>
          ) : infinite.items.length === 0 ? (
            emptyNode
          ) : (
            <>
              <div className="space-y-3">{infinite.items.map(renderMobileCard)}</div>
              <div ref={infinite.sentinelRef} className="h-1" />
              {infinite.loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>

        <MobileListFooter shown={infinite.items.length} total={infinite.total} nounKey="common.units.tickets" />
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
          <h1 className="text-3xl font-bold tracking-tight">{t('tickets.title')}</h1>
          <p className="text-muted-foreground">{t('tickets.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFaqOpen(true)} className="gap-2">
            <HelpCircle className="h-4 w-4" /> FAQ
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('tickets.list.newTicket')}
          </Button>
        </div>
      </div>

      {filtersNode}

      {/* Content */}
      {loading ? (
        <TicketListSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <TicketIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>{t('common.actions.retry')}</Button>
        </div>
      ) : tickets.length === 0 ? (
        emptyNode
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('tickets.detail.ticket')}</th>
                  <th className="px-4 py-3">{t('tickets.columns.status')}</th>
                  <th className="px-4 py-3">{t('tickets.columns.priority')}</th>
                  <th className="px-4 py-3">{t('tickets.columns.updated')}</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => setDetailId(t._id)}
                    className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <TicketIdentity t={t} />
                    </td>
                    <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                    <td className="px-4 py-3"><PriorityPill priority={t.priority} locked={t.priority_locked} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeTime(t.updatedAt, translate, fmt.date)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer / pagination */}
          {meta && (
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <span>
                {t('common.pagination.showingOf', {
                  shown: tickets.length,
                  items: t('common.units.tickets', { count: meta.total }),
                })}
              </span>
              {meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t('common.pagination.previous')}
                  </Button>
                  <span>
                    {t('common.pagination.pageOf', { page: meta.page, total: meta.totalPages })}
                  </span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
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

// ─── Row identity (icon + subject + ref + entity) ─────────────────────────────

// Keyed loosely on purpose: a ticket filed under any of the API's entity types
// can come back here, including the ones this dashboard never offers, and an
// unknown key falls through to the generic tag icon.
const ENTITY_ICONS: Record<string, typeof Tag> = {
  ORDER: ShoppingCart,
  PRODUCT: Package,
  BOOKING: Calendar,
  VENDOR: Store,
  USER: User,
  CUSTOMER: User,
  AGENT: User,
  AGENCY: Store,
  SHIPMENT: Truck,
  DELIVERY: Truck,
};

function EntityChip({ entity, entityType }: { entity: TicketEntityRef | null; entityType: string }) {
  const key = (entity?.type ?? entityType ?? '').toUpperCase();
  const Icon = ENTITY_ICONS[key] ?? Tag;
  const label = entity?.label ?? entityType;
  if (!label) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function TicketIdentity({ t }: { t: ApiTicketListItem }) {
  const { Icon, className } = getTypeVisual(t.type);
  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{t.subject}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{shortTicketRef(t._id)}</span>
          <span>·</span>
          <EntityChip entity={t.entity} entityType={t.entity_type} />
        </div>
      </div>
    </div>
  );
}

// ─── Pills ────────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', STATUS_BADGE_CLASSES[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[status])} />
      {t(STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

function PriorityPill({ priority, locked }: { priority: TicketPriority; locked?: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', PRIORITY_BADGE_CLASSES[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_CLASSES[priority])} />
      {t(PRIORITY_LABEL_KEYS[priority])}
      {locked && <LockGlyph />}
    </Badge>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TicketListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="hidden h-3 w-12 sm:block" />
        </div>
      ))}
    </div>
  );
}
