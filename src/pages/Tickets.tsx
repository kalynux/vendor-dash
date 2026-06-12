import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Ticket as TicketIcon, ChevronRight,
  ShoppingCart, Package, Calendar, User, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia,
} from '@/components/ui/empty';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CreateTicketSheet } from '@/components/tickets/CreateTicketSheet';
import { TicketDetailSheet } from '@/components/tickets/TicketDetailSheet';
import {
  STATUS_LABELS, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, STATUS_TABS,
  PRIORITY_LABELS, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  TICKET_TYPE_GROUPS, getTypeVisual, shortTicketRef, relativeTime,
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

export function Tickets() {
  const [tickets, setTickets] = useState<ApiTicketListItem[]>([]);
  const [meta, setMeta] = useState<TicketListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<UpdatablePriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

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

  // Debounce the raw search box; reset to page 1 on change.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
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

  useEffect(() => {
    load(queryParams);
  }, [load, queryParams]);

  const refresh = useCallback(() => load(queryParams), [load, queryParams]);

  function clearFilters() {
    setStatusFilter(null);
    setPriorityFilter('');
    setTypeFilter('');
    setSearchQuery('');
    setPage(1);
  }

  const hasActiveQuery =
    !!statusFilter || !!priorityFilter || !!typeFilter || searchQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">Track and resolve issues with the Jovi Mall team.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </div>

      {/* Status tabs */}
      <div className="-mx-1 overflow-x-auto">
        <div className="flex min-w-max items-center gap-1 border-b px-1">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.label}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                className={cn(
                  'relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tickets by subject or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
          {/* Type */}
          <Select
            value={typeFilter || ALL}
            onValueChange={(v) => { setTypeFilter(v === ALL ? '' : (v as TicketType)); setPage(1); }}
          >
            <SelectTrigger className="w-40 shrink-0 lg:w-44"><SelectValue placeholder="All types" /></SelectTrigger>
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

          {/* Priority */}
          <Select
            value={priorityFilter || ALL}
            onValueChange={(v) => { setPriorityFilter(v === ALL ? '' : (v as UpdatablePriority)); setPage(1); }}
          >
            <SelectTrigger className="w-36 shrink-0 lg:w-40"><SelectValue placeholder="All priorities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); setPage(1); }}>
            <SelectTrigger className="w-44 shrink-0 lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>Sort: {o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
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

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {tickets.map((t) => (
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
            ))}
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

      {/* Create + detail */}
      <CreateTicketSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          toast.success('Ticket added to your list');
          setPage(1);
          refresh();
        }}
      />
      <TicketDetailSheet
        ticketId={detailId}
        open={!!detailId}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
        onUpdated={refresh}
      />
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
