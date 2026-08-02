import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Ticket as TicketIcon, ChevronRight,
  ShoppingCart, Package, Calendar, User, Tag, HelpCircle, Loader2,
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
  STATUS_LABELS, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, STATUS_TABS,
  PRIORITY_LABELS, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  TICKET_TYPE_GROUPS, TICKET_TYPE_LABELS, getTypeVisual, shortTicketRef, relativeTime,
} from '@/components/tickets/ticket.constants';
import { fetchTickets } from '@/services/tickets.service';
import { ApiError } from '@/types/api';
import type {
  ApiTicketListItem, TicketListMeta, TicketsQueryParams,
  TicketStatus, TicketPriority, TicketType, UpdatablePriority,
  TicketEntityRef,
} from '@/types/tickets.types';

const PAGE_LIMIT = 20;
const ALL = '__all__';

type SortKey = 'updated' | 'created' | 'priority';
const SORT_OPTIONS: { value: SortKey; label: string; sortBy: TicketsQueryParams['sortBy']; sortOrder: 'asc' | 'desc' }[] = [
  { value: 'updated', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
  { value: 'created', label: 'Recently created', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'priority', label: 'Priority', sortBy: 'priority', sortOrder: 'desc' },
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
        setError(err instanceof ApiError ? err.message : 'Failed to load tickets');
        setTickets([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [],
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
      label: `Status: ${STATUS_LABELS[statusFilter] ?? statusFilter}`,
      onRemove: () => { setStatusFilter(null); setPage(1); },
    });
  }
  if (typeFilter) {
    activeChips.push({
      key: 'type',
      label: `Type: ${TICKET_TYPE_LABELS[typeFilter] ?? typeFilter}`,
      onRemove: () => { setTypeFilter(''); setPage(1); },
    });
  }
  if (priorityFilter) {
    activeChips.push({
      key: 'priority',
      label: `Priority: ${PRIORITY_LABELS[priorityFilter]}`,
      onRemove: () => { setPriorityFilter(''); setPage(1); },
    });
  }
  if (sort !== SORT_OPTIONS[0].value) {
    activeChips.push({
      key: 'sort',
      label: `Sort: ${sortConfig.label}`,
      onRemove: () => { setSort(SORT_OPTIONS[0].value); setPage(1); },
    });
  }

  const filtersNode = (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search tickets…"
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel="Filter tickets"
      />
      <ActiveFilterChips chips={activeChips} onClearAll={clearFilters} />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title="Filter tickets"
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel="Show tickets"
    >
      <FilterSection title="Status">
        <FilterChips
          options={STATUS_TABS.filter((t): t is { label: string; value: TicketStatus } => t.value !== null)
            .map((t) => ({ value: t.value, label: t.label }))}
          value={statusFilter ?? undefined}
          onChange={(v) => { setStatusFilter(v ?? null); setPage(1); }}
          allLabel="Any status"
        />
      </FilterSection>

      <FilterSection title="Priority">
        <FilterChips
          options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          value={priorityFilter || undefined}
          onChange={(v) => { setPriorityFilter((v ?? '') as UpdatablePriority | ''); setPage(1); }}
          allLabel="Any"
        />
      </FilterSection>

      {/* Type has ~40 values across 8 groups — a grouped select stays scannable
          where a chip wall would not. */}
      <FilterSection title="Type">
        <FilterField>
          <Select
            value={typeFilter || ALL}
            onValueChange={(v) => { setTypeFilter(v === ALL ? '' : (v as TicketType)); setPage(1); }}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {TICKET_TYPE_GROUPS.map((g) => (
                <SelectGroup key={g.groupLabel}>
                  <SelectLabel>{g.groupLabel}</SelectLabel>
                  {g.values.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterSection>

      <FilterSection title="Sort by">
        <FilterChips
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
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
        <EmptyTitle>{hasActiveQuery ? 'No matching tickets' : 'No tickets yet'}</EmptyTitle>
        <EmptyDescription>
          {hasActiveQuery
            ? 'Try adjusting your search or filters.'
            : 'Create your first ticket to get help from the team.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasActiveQuery ? (
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
        ) : (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New ticket
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
        <span className="ml-auto text-xs text-muted-foreground">{relativeTime(t.updatedAt)}</span>
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
          toast.success('Ticket added to your list');
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
          title="Tickets"
          actions={
            <>
              <button
                type="button"
                onClick={() => setFaqOpen(true)}
                aria-label="FAQ"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label="New ticket"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            </>
          }
          subheader={filtersNode}
        />

        <div className="px-4 pt-3 pb-28">
          {infinite.loading ? (
            <TicketListSkeleton />
          ) : infinite.error ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <TicketIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{infinite.error}</p>
              <Button variant="outline" size="sm" onClick={infinite.reload}>Try again</Button>
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

        <MobileListFooter shown={infinite.items.length} total={infinite.total} noun="tickets" />
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
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">Track and resolve issues with the Jovi Mall team.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFaqOpen(true)} className="gap-2">
            <HelpCircle className="h-4 w-4" /> FAQ
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New ticket
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
          <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
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
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Updated</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeTime(t.updatedAt)}</td>
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
                Showing {tickets.length} of {meta.total} ticket{meta.total !== 1 ? 's' : ''}
              </span>
              {meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span>Page {meta.page} of {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
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

const ENTITY_ICONS: Record<string, typeof Tag> = {
  ORDER: ShoppingCart,
  PRODUCT: Package,
  BOOKING: Calendar,
  ACCOUNT: User,
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
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', STATUS_BADGE_CLASSES[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[status])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function PriorityPill({ priority, locked }: { priority: TicketPriority; locked?: boolean }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', PRIORITY_BADGE_CLASSES[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_CLASSES[priority])} />
      {PRIORITY_LABELS[priority]}
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
