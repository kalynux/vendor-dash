import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, CalendarClock, Loader2, Clock, Grid3X3, List,
  MoreHorizontal, Edit, Rocket, RotateCcw, Trash2, Sparkles, RotateCw, XCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
} from '@/components/filters';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { ServiceStatusBadge } from '@/components/services/StatusBadges';
import {
  formatDuration, BOOKING_MODE_LABELS, SERVICE_STATUS_TRANSITIONS,
  type ServiceStatusTransition,
} from '@/components/services/service.constants';
import {
  fetchServices, changeServiceStatus, setVectorisationEnabled, retryVectorisation,
  SERVICE_ACTIVATION_ERROR_MAP,
} from '@/services/services.service';
import { ApiError } from '@/types/api';
import type { ApiVectorisationStatus } from '@/types/product.types';
import type {
  ServiceListItem, ServiceListMeta, ServicesQueryParams, ServiceStatus,
} from '@/types/services.types';

const PAGE_LIMIT = 20;

type ViewMode = 'grid' | 'list';
type VectorisationAction = 'enable' | 'disable' | 'retry';

interface ServicesListPanelProps {
  onOpenDetail: (id: string) => void;
  onCreate: () => void;
  /** Bump to force a refetch after create / edits elsewhere. */
  reloadToken: number;
}

const STATUS_OPTIONS: { value: ServiceStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

// ─── Vectorisation badge (mirrors the products listing) ─────────────────────────

const VECTORISATION_META: Record<
  ApiVectorisationStatus,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  not_started: { label: 'Not indexed', className: 'bg-muted text-muted-foreground', Icon: Sparkles },
  pending: {
    label: 'Indexing…',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Icon: Loader2,
  },
  completed: {
    label: 'AI search ready',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Indexing failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Icon: XCircle,
  },
};

function VectorisationBadge({ enabled, status }: { enabled: boolean; status: ApiVectorisationStatus }) {
  if (!enabled) return null;
  const meta = VECTORISATION_META[status];
  const { Icon } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', meta.className)}>
      <Icon className={cn('h-3 w-3', status === 'pending' && 'animate-spin')} />
      {meta.label}
    </span>
  );
}

function transitionIcon(t: ServiceStatusTransition) {
  if (t.needsPreflight) return Rocket;
  if (t.destructive) return Trash2;
  return RotateCcw;
}

// ─── Per-row actions menu ───────────────────────────────────────────────────────

interface ServiceActionsMenuProps {
  service: ServiceListItem;
  onEdit: () => void;
  onStatusTransition: (t: ServiceStatusTransition) => void;
  onVectorisation: (action: VectorisationAction) => void;
}

function ServiceActionsMenu({ service, onEdit, onStatusTransition, onVectorisation }: ServiceActionsMenuProps) {
  const transitions = SERVICE_STATUS_TRANSITIONS[service.status] ?? [];
  const nonDestructive = transitions.filter((t) => !t.destructive);
  const archive = transitions.find((t) => t.destructive);

  // While indexing is in flight every mutating action is locked (open editor,
  // status changes, AI-search toggles) — mirrors products.
  const indexing = service.vectorisationStatus === 'pending';
  const editLocked = indexing;
  const showEnable = !service.vectorisationEnabled;
  const showDisable = service.vectorisationEnabled && service.vectorisationStatus !== 'pending';
  const showRetry = service.vectorisationEnabled && service.vectorisationStatus === 'failed';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={editLocked ? undefined : onEdit} disabled={editLocked}>
          <Edit className="mr-2 h-4 w-4" />
          {editLocked ? 'Edit (locked — indexing)' : 'Edit'}
        </DropdownMenuItem>

        {nonDestructive.map((t) => {
          const Icon = transitionIcon(t);
          return (
            <DropdownMenuItem
              key={t.target + t.label}
              onClick={indexing ? undefined : () => onStatusTransition(t)}
              disabled={indexing}
            >
              <Icon className="mr-2 h-4 w-4" />
              {t.label}
            </DropdownMenuItem>
          );
        })}

        {showEnable && (
          <DropdownMenuItem onClick={() => onVectorisation('enable')}>
            <Sparkles className="mr-2 h-4 w-4" />
            Enable AI search
          </DropdownMenuItem>
        )}
        {showRetry && (
          <DropdownMenuItem onClick={() => onVectorisation('retry')}>
            <RotateCw className="mr-2 h-4 w-4" />
            Retry AI search
          </DropdownMenuItem>
        )}
        {showDisable && (
          <DropdownMenuItem onClick={() => onVectorisation('disable')}>
            <XCircle className="mr-2 h-4 w-4" />
            Disable AI search
          </DropdownMenuItem>
        )}

        {archive && (
          <DropdownMenuItem
            onClick={indexing ? undefined : () => onStatusTransition(archive)}
            disabled={indexing}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {archive.label}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Mobile actions-sheet row ────────────────────────────────────────────────────

function ServiceSheetActionButton({
  icon,
  label,
  disabled,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
        destructive && 'text-destructive',
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ─── Grid card ──────────────────────────────────────────────────────────────────

interface ServiceCardProps {
  service: ServiceListItem;
  onOpen: () => void;
  actions: React.ReactNode;
}

function ServiceGridCard({ service, onOpen, actions }: ServiceCardProps) {
  return (
    <Card
      onClick={onOpen}
      className="group cursor-pointer gap-0 overflow-hidden transition-all hover:shadow-lg"
    >
      <div className="relative aspect-square bg-muted">
        {service.firstFileUrl ? (
          <img
            src={service.firstFileUrl}
            alt={service.title}
            crossOrigin="use-credentials"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
          <ServiceStatusBadge status={service.status} />
          <VectorisationBadge enabled={service.vectorisationEnabled} status={service.vectorisationStatus} />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{service.title}</h3>
            <p className="truncate text-xs text-muted-foreground">{service.category}</p>
          </div>
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────────

export function ServicesListPanel({ onOpenDetail, onCreate, reloadToken }: ServicesListPanelProps) {
  const isMobile = useIsMobile();

  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [meta, setMeta] = useState<ServiceListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | ''>('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  // Bumped after a row action to refetch the current view.
  const [localReload, setLocalReload] = useState(0);
  const refetch = useCallback(() => setLocalReload((n) => n + 1), []);

  // Destructive transition confirmation.
  const [pendingTransition, setPendingTransition] =
    useState<{ service: ServiceListItem; transition: ServiceStatusTransition } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Mobile per-row actions live in a bottom sheet (desktop keeps the dropdown).
  const [actionsSheetService, setActionsSheetService] = useState<ServiceListItem | null>(null);

  // Debounce search.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const queryParams: ServicesQueryParams = useMemo(() => ({
    q: debouncedSearch || undefined,
    status: statusFilter || undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    page,
    limit: PAGE_LIMIT,
  }), [debouncedSearch, statusFilter, page]);

  const load = useCallback(async (params: ServicesQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchServices(params);
      setServices(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load services');
      setServices([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Desktop: page-based.
  useEffect(() => {
    if (isMobile) return;
    load(queryParams);
  }, [isMobile, queryParams, load, reloadToken, localReload]);

  // Mobile: infinite.
  const fetchPage = useCallback(
    (pageArg: number, limit: number) =>
      fetchServices({
        q: debouncedSearch || undefined,
        status: statusFilter || undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        page: pageArg,
        limit,
      }).then((r) => ({ items: r.data, total: r.meta.total, totalPages: r.meta.pages })),
    [debouncedSearch, statusFilter],
  );

  const infinite = useInfiniteList<ServiceListItem>({
    fetchPage,
    rowHeight: 76,
    enabled: isMobile,
    deps: [debouncedSearch, statusFilter, reloadToken, localReload],
  });

  const hasActiveQuery = !!statusFilter || searchQuery.trim().length > 0;

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('');
    setPage(1);
  }

  // ─── Row actions ──────────────────────────────────────────────────────────────

  const applyTransition = useCallback(async (service: ServiceListItem, target: ServiceStatus) => {
    setActionBusy(true);
    try {
      await changeServiceStatus(service.id, target);
      toast.success('Service updated');
      refetch();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? SERVICE_ACTIVATION_ERROR_MAP[err.code] ?? err.message
          : 'Failed to update service.',
      );
    } finally {
      setActionBusy(false);
    }
  }, [refetch]);

  // Opening the editor is blocked while AI indexing is in flight (mirrors products).
  const openService = useCallback((service: ServiceListItem) => {
    if (service.vectorisationStatus === 'pending') {
      toast.error('Editing is locked while AI indexing is in progress.');
      return;
    }
    onOpenDetail(service.id);
  }, [onOpenDetail]);

  const requestTransition = useCallback((service: ServiceListItem, transition: ServiceStatusTransition) => {
    if (service.vectorisationStatus === 'pending') {
      toast.error('Status changes are locked while AI indexing is in progress.');
      return;
    }
    if (transition.destructive || transition.confirmMessage) {
      setPendingTransition({ service, transition });
      return;
    }
    applyTransition(service, transition.target);
  }, [applyTransition]);

  const confirmTransition = useCallback(async () => {
    if (!pendingTransition) return;
    await applyTransition(pendingTransition.service, pendingTransition.transition.target);
    setPendingTransition(null);
  }, [pendingTransition, applyTransition]);

  const handleVectorisation = useCallback(async (service: ServiceListItem, action: VectorisationAction) => {
    if (service.vectorisationStatus === 'pending') {
      toast.error('AI search is being indexed — please wait until it finishes.');
      return;
    }
    try {
      if (action === 'retry') {
        await retryVectorisation(service.id);
        toast.success('AI search retry queued');
      } else {
        await setVectorisationEnabled(service.id, action === 'enable');
        toast.success(action === 'enable' ? 'AI search enabled' : 'AI search disabled');
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI search could not be updated.');
    }
  }, [refetch]);

  const renderActions = (service: ServiceListItem) => (
    <ServiceActionsMenu
      service={service}
      onEdit={() => openService(service)}
      onStatusTransition={(t) => requestTransition(service, t)}
      onVectorisation={(action) => handleVectorisation(service, action)}
    />
  );

  // ─── Shared building blocks ─────────────────────────────────────────────────────

  const viewToggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
      <TabsList className="h-11 rounded-xl">
        <TabsTrigger value="grid" aria-label="Grid view"><Grid3X3 className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="list" aria-label="List view"><List className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const activeFilterCount = statusFilter ? 1 : 0;

  const filtersNode = (trailing?: React.ReactNode) => (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search services…"
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel="Filter services"
        trailing={trailing}
      />
      <ActiveFilterChips
        chips={statusFilter
          ? [{
            key: 'status',
            label: `Status: ${STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter}`,
            onRemove: () => { setStatusFilter(''); setPage(1); },
          }]
          : []}
      />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title="Filter services"
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel="Show services"
    >
      <FilterSection title="Status">
        <FilterChips
          options={STATUS_OPTIONS.filter((o): o is { value: ServiceStatus; label: string } => o.value !== '')}
          value={statusFilter || undefined}
          onChange={(v) => { setStatusFilter(v ?? ''); setPage(1); }}
          allLabel="All statuses"
        />
      </FilterSection>
    </FilterSheet>
  );

  const emptyNode = (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarClock className="h-6 w-6" /></EmptyMedia>
        <EmptyTitle>{hasActiveQuery ? 'No matching services' : 'No services yet'}</EmptyTitle>
        <EmptyDescription>
          {hasActiveQuery
            ? 'Try adjusting your search or status filter.'
            : 'Create a bookable service to start accepting appointments.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasActiveQuery ? (
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
        ) : (
          <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" /> New service</Button>
        )}
      </EmptyContent>
    </Empty>
  );

  const gridNode = (items: ServiceListItem[]) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((s) => (
        <ServiceGridCard
          key={s.id}
          service={s}
          onOpen={() => openService(s)}
          actions={renderActions(s)}
        />
      ))}
    </div>
  );

  const tableNode = (items: ServiceListItem[]) => (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Status</th>
            <th className="w-8 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            console.log({ s })
            return (
              <tr
                key={s.id}
                onClick={() => openService(s)}
                className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {s.firstFileUrl ? (
                        <img src={s.firstFileUrl} alt="" className="h-full w-full object-cover" crossOrigin="use-credentials" />
                      ) : (
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.category}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDuration(s.durationMinutes)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.bookingMode ? BOOKING_MODE_LABELS[s.bookingMode] : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <ServiceStatusBadge status={s.status} />
                    <VectorisationBadge enabled={s.vectorisationEnabled} status={s.vectorisationStatus} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{renderActions(s)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );

  const mobileListNode = (items: ServiceListItem[]) => (
    <div className="-mx-1">
      {items.map((s) => (
        <div
          key={s.id}
          onClick={() => openService(s)}
          className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {s.firstFileUrl ? (
              <img src={s.firstFileUrl} alt="" className="h-full w-full object-cover" crossOrigin="use-credentials" />
            ) : (
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{s.title}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatDuration(s.durationMinutes)}
              {s.bookingMode && ` · ${BOOKING_MODE_LABELS[s.bookingMode]}`}
            </p>
          </div>
          <ServiceStatusBadge status={s.status} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActionsSheetService(s);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
            aria-label="Service actions"
          >
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );

  const confirmDialog = (
    <AlertDialog open={!!pendingTransition} onOpenChange={(o) => { if (!o) setPendingTransition(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pendingTransition?.transition.label ?? 'Confirm'}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingTransition?.transition.confirmMessage ?? 'Apply this status change?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmTransition(); }}
            disabled={actionBusy}
            className={cn(pendingTransition?.transition.destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          >
            {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const actionsSheet = (
    <Sheet
      open={!!actionsSheetService}
      onOpenChange={(open) => { if (!open) setActionsSheetService(null); }}
    >
      <SheetContent side="bottom" className="p-0">
        {actionsSheetService && (() => {
          const s = actionsSheetService;
          const close = () => setActionsSheetService(null);
          const indexing = s.vectorisationStatus === 'pending';
          const transitions = SERVICE_STATUS_TRANSITIONS[s.status] ?? [];
          const nonDestructive = transitions.filter((t) => !t.destructive);
          const archive = transitions.find((t) => t.destructive);
          const showEnable = !s.vectorisationEnabled;
          const showDisable = s.vectorisationEnabled && !indexing;
          const showRetry = s.vectorisationEnabled && s.vectorisationStatus === 'failed';

          return (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="truncate pr-8 text-base">{s.title}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col py-2 pb-6">
                <ServiceSheetActionButton
                  icon={<Edit className="h-5 w-5" />}
                  label={indexing ? 'Edit (locked — indexing)' : 'Edit'}
                  disabled={indexing}
                  onClick={() => { close(); openService(s); }}
                />
                {nonDestructive.map((t) => {
                  const Icon = transitionIcon(t);
                  return (
                    <ServiceSheetActionButton
                      key={t.target + t.label}
                      icon={<Icon className="h-5 w-5" />}
                      label={t.label}
                      disabled={indexing}
                      onClick={() => { close(); requestTransition(s, t); }}
                    />
                  );
                })}
                {showEnable && (
                  <ServiceSheetActionButton
                    icon={<Sparkles className="h-5 w-5" />}
                    label="Enable AI search"
                    onClick={() => { close(); handleVectorisation(s, 'enable'); }}
                  />
                )}
                {showRetry && (
                  <ServiceSheetActionButton
                    icon={<RotateCw className="h-5 w-5" />}
                    label="Retry AI search"
                    onClick={() => { close(); handleVectorisation(s, 'retry'); }}
                  />
                )}
                {showDisable && (
                  <ServiceSheetActionButton
                    icon={<XCircle className="h-5 w-5" />}
                    label="Disable AI search"
                    onClick={() => { close(); handleVectorisation(s, 'disable'); }}
                  />
                )}
                {archive && (
                  <ServiceSheetActionButton
                    icon={<Trash2 className="h-5 w-5" />}
                    label={archive.label}
                    destructive
                    disabled={indexing}
                    onClick={() => { close(); requestTransition(s, archive); }}
                  />
                )}
              </div>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );

  // ── Mobile ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="space-y-3">
        {filtersNode(
          <Button onClick={onCreate} aria-label="New service" className="h-11 w-11 shrink-0 rounded-xl p-0">
            <Plus className="h-5 w-5" />
          </Button>,
        )}
        {infinite.loading ? (
          <ListSkeleton mobile />
        ) : infinite.error ? (
          <ErrorState message={infinite.error} onRetry={infinite.reload} />
        ) : infinite.items.length === 0 ? (
          emptyNode
        ) : (
          <div>
            {mobileListNode(infinite.items)}
            <div ref={infinite.sentinelRef} className="h-1" />
            {infinite.loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
        {confirmDialog}
        {actionsSheet}
        {filterSheet}
      </div>
    );
  }

  // ── Desktop ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {filtersNode(
        <>
          {viewToggle}
          <Button onClick={onCreate} className="h-11 shrink-0 gap-2">
            <Plus className="h-4 w-4" /> New service
          </Button>
        </>,
      )}
      {filterSheet}

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(queryParams)} />
      ) : services.length === 0 ? (
        emptyNode
      ) : (
        <>
          {viewMode === 'grid' ? gridNode(services) : tableNode(services)}

          {meta && (
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <span>Showing {services.length} of {meta.total} service{meta.total !== 1 ? 's' : ''}</span>
              {meta.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span>Page {meta.page} of {meta.pages}</span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {confirmDialog}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function ListSkeleton({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square" />
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
