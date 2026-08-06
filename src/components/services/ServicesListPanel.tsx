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
import { useTranslation, useApiError, type TranslationKey } from '@/i18n';
import { ServiceStatusBadge } from '@/components/services/StatusBadges';
import {
  formatDuration, BOOKING_MODE_LABEL_KEYS, SERVICE_STATUS_TRANSITIONS,
  type ServiceStatusTransition,
} from '@/components/services/service.constants';
import {
  fetchServices, changeServiceStatus, setVectorisationEnabled, retryVectorisation,
} from '@/services/services.service';
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

const STATUS_OPTIONS: { value: ServiceStatus; labelKey: TranslationKey }[] = [
  { value: 'draft', labelKey: 'services.status.draft' },
  { value: 'active', labelKey: 'services.status.active' },
  { value: 'archived', labelKey: 'services.status.archived' },
];

// ─── Vectorisation badge (mirrors the products listing) ─────────────────────────

const VECTORISATION_META: Record<
  ApiVectorisationStatus,
  { labelKey: TranslationKey; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  not_started: {
    labelKey: 'services.vectorisation.notStarted',
    className: 'bg-muted text-muted-foreground',
    Icon: Sparkles,
  },
  pending: {
    labelKey: 'services.vectorisation.pending',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Icon: Loader2,
  },
  completed: {
    labelKey: 'services.vectorisation.completed',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle2,
  },
  failed: {
    labelKey: 'services.vectorisation.failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Icon: XCircle,
  },
};

function VectorisationBadge({ enabled, status }: { enabled: boolean; status: ApiVectorisationStatus }) {
  const { t } = useTranslation();
  if (!enabled) return null;
  const meta = VECTORISATION_META[status];
  const { Icon } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', meta.className)}>
      <Icon className={cn('h-3 w-3', status === 'pending' && 'animate-spin')} />
      {t(meta.labelKey)}
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
  const { t } = useTranslation();
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
          {editLocked ? t('services.vectorisation.editLocked') : t('common.actions.edit')}
        </DropdownMenuItem>

        {nonDestructive.map((transition) => {
          const Icon = transitionIcon(transition);
          return (
            <DropdownMenuItem
              key={transition.target + transition.labelKey}
              onClick={indexing ? undefined : () => onStatusTransition(transition)}
              disabled={indexing}
            >
              <Icon className="mr-2 h-4 w-4" />
              {t(transition.labelKey)}
            </DropdownMenuItem>
          );
        })}

        {showEnable && (
          <DropdownMenuItem onClick={() => onVectorisation('enable')}>
            <Sparkles className="mr-2 h-4 w-4" />
            {t('services.vectorisation.enable')}
          </DropdownMenuItem>
        )}
        {showRetry && (
          <DropdownMenuItem onClick={() => onVectorisation('retry')}>
            <RotateCw className="mr-2 h-4 w-4" />
            {t('services.vectorisation.retry')}
          </DropdownMenuItem>
        )}
        {showDisable && (
          <DropdownMenuItem onClick={() => onVectorisation('disable')}>
            <XCircle className="mr-2 h-4 w-4" />
            {t('services.vectorisation.disable')}
          </DropdownMenuItem>
        )}

        {archive && (
          <DropdownMenuItem
            onClick={indexing ? undefined : () => onStatusTransition(archive)}
            disabled={indexing}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t(archive.labelKey)}
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
  const { t } = useTranslation();
  const apiError = useApiError();

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
      setError(apiError.resolve(err, { fallbackKey: 'services.errors.loadFailed' }));
      setServices([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [apiError]);

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
      toast.success(t('services.toast.statusUpdated'));
      refetch();
    } catch (err) {
      apiError.toast(err, {
        context: 'service',
        fallbackKey: 'services.errors.statusChangeFailed',
      });
    } finally {
      setActionBusy(false);
    }
  }, [refetch, t, apiError]);

  // Opening the editor is blocked while AI indexing is in flight (mirrors products).
  const openService = useCallback((service: ServiceListItem) => {
    if (service.vectorisationStatus === 'pending') {
      toast.error(t('services.vectorisation.editLockedToast'));
      return;
    }
    onOpenDetail(service.id);
  }, [onOpenDetail, t]);

  const requestTransition = useCallback((service: ServiceListItem, transition: ServiceStatusTransition) => {
    if (service.vectorisationStatus === 'pending') {
      toast.error(t('services.vectorisation.statusLockedToast'));
      return;
    }
    if (transition.destructive || transition.confirmKey) {
      setPendingTransition({ service, transition });
      return;
    }
    applyTransition(service, transition.target);
  }, [applyTransition, t]);

  const confirmTransition = useCallback(async () => {
    if (!pendingTransition) return;
    await applyTransition(pendingTransition.service, pendingTransition.transition.target);
    setPendingTransition(null);
  }, [pendingTransition, applyTransition]);

  const handleVectorisation = useCallback(async (service: ServiceListItem, action: VectorisationAction) => {
    if (service.vectorisationStatus === 'pending') {
      toast.error(t('services.vectorisation.busyToast'));
      return;
    }
    try {
      if (action === 'retry') {
        await retryVectorisation(service.id);
        toast.success(t('services.vectorisation.retryQueued'));
      } else {
        await setVectorisationEnabled(service.id, action === 'enable');
        toast.success(
          action === 'enable'
            ? t('services.vectorisation.enabled')
            : t('services.vectorisation.disabled'),
        );
      }
      refetch();
    } catch (err) {
      apiError.toast(err, {
        context: 'service',
        fallbackKey: 'services.vectorisation.updateFailed',
      });
    }
  }, [refetch, t, apiError]);

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
        <TabsTrigger value="grid" aria-label={t('services.list.gridView')}><Grid3X3 className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="list" aria-label={t('services.list.listView')}><List className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const activeFilterCount = statusFilter ? 1 : 0;

  const filtersNode = (trailing?: React.ReactNode) => (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('services.list.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel={t('services.list.filterTitle')}
        trailing={trailing}
      />
      <ActiveFilterChips
        chips={statusFilter
          ? [{
            key: 'status',
            label: t('services.list.statusChip', {
              value: t(
                STATUS_OPTIONS.find((o) => o.value === statusFilter)?.labelKey
                  ?? 'services.list.statusSection',
              ),
            }),
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
      title={t('services.list.filterTitle')}
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel={t('services.list.applyFilters')}
    >
      <FilterSection title={t('services.list.statusSection')}>
        <FilterChips
          options={STATUS_OPTIONS}
          value={statusFilter || undefined}
          onChange={(v) => { setStatusFilter(v ?? ''); setPage(1); }}
          allLabel={t('services.list.allStatuses')}
        />
      </FilterSection>
    </FilterSheet>
  );

  const emptyNode = (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarClock className="h-6 w-6" /></EmptyMedia>
        <EmptyTitle>
          {hasActiveQuery ? t('services.list.emptyFilteredTitle') : t('services.list.emptyTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {hasActiveQuery
            ? t('services.list.emptyFilteredDescription')
            : t('services.list.emptyDescription')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasActiveQuery ? (
          <Button variant="outline" onClick={clearFilters}>{t('common.actions.clearAll')}</Button>
        ) : (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t('services.list.newService')}
          </Button>
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
            <th className="px-4 py-3">{t('services.list.columns.service')}</th>
            <th className="px-4 py-3">{t('services.list.columns.duration')}</th>
            <th className="px-4 py-3">{t('services.list.columns.mode')}</th>
            <th className="px-4 py-3">{t('services.list.columns.status')}</th>
            <th className="w-8 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
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
                <td className="px-4 py-3 text-muted-foreground">{formatDuration(s.durationMinutes, t)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.bookingMode ? t(BOOKING_MODE_LABEL_KEYS[s.bookingMode]) : t('common.labels.emptyValue')}
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
              <Clock className="h-3 w-3" /> {formatDuration(s.durationMinutes, t)}
              {s.bookingMode && ` · ${t(BOOKING_MODE_LABEL_KEYS[s.bookingMode])}`}
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
            aria-label={t('services.list.rowActions')}
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
          <AlertDialogTitle>
            {pendingTransition
              ? t(pendingTransition.transition.labelKey)
              : t('services.transitions.confirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingTransition?.transition.confirmKey
              ? t(pendingTransition.transition.confirmKey)
              : t('services.transitions.confirm.generic')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionBusy}>{t('common.actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmTransition(); }}
            disabled={actionBusy}
            className={cn(pendingTransition?.transition.destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          >
            {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.actions.confirm')}
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
                  label={indexing ? t('services.vectorisation.editLocked') : t('common.actions.edit')}
                  disabled={indexing}
                  onClick={() => { close(); openService(s); }}
                />
                {nonDestructive.map((transition) => {
                  const Icon = transitionIcon(transition);
                  return (
                    <ServiceSheetActionButton
                      key={transition.target + transition.labelKey}
                      icon={<Icon className="h-5 w-5" />}
                      label={t(transition.labelKey)}
                      disabled={indexing}
                      onClick={() => { close(); requestTransition(s, transition); }}
                    />
                  );
                })}
                {showEnable && (
                  <ServiceSheetActionButton
                    icon={<Sparkles className="h-5 w-5" />}
                    label={t('services.vectorisation.enable')}
                    onClick={() => { close(); handleVectorisation(s, 'enable'); }}
                  />
                )}
                {showRetry && (
                  <ServiceSheetActionButton
                    icon={<RotateCw className="h-5 w-5" />}
                    label={t('services.vectorisation.retry')}
                    onClick={() => { close(); handleVectorisation(s, 'retry'); }}
                  />
                )}
                {showDisable && (
                  <ServiceSheetActionButton
                    icon={<XCircle className="h-5 w-5" />}
                    label={t('services.vectorisation.disable')}
                    onClick={() => { close(); handleVectorisation(s, 'disable'); }}
                  />
                )}
                {archive && (
                  <ServiceSheetActionButton
                    icon={<Trash2 className="h-5 w-5" />}
                    label={t(archive.labelKey)}
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
          <Button onClick={onCreate} aria-label={t('services.list.newService')} className="h-11 w-11 shrink-0 rounded-xl p-0">
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
            <Plus className="h-4 w-4" /> {t('services.list.newService')}
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
              <span>
                {t('common.pagination.showingOf', {
                  shown: services.length,
                  items: t('services.list.count', { count: meta.total }),
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
      {confirmDialog}
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
