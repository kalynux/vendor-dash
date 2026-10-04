import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, PackageSearch, Plus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
  type ActiveFilterChip,
  type FilterOption,
} from '@/components/filters';

import { InventoryPagination } from './InventoryPagination';
import { StockRequestActions } from './StockRequestActions';
import { StockRequestDetailSheet } from './StockRequestDetailSheet';
import { StockRequestProduct } from './StockRequestProduct';
import { RaiseStockRequestDialog, type RaiseStockRequestSeed } from './RaiseStockRequestDialog';
import {
  DIRECTION_LABEL_KEYS,
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  STATUS_LABEL_KEYS,
  STOCK_REQUEST_DIRECTIONS,
  STOCK_REQUEST_STATUSES,
  shortVariantId,
  stockRequestPlace,
} from './stockRequest.constants';

import { fetchStockRequests } from '@/services/stockRequests.service';
import { useStockRequestActions } from '@/hooks/useStockRequestActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConnectedAgencyLookup, type ConnectedAgencyIdentity } from '@/hooks/use-connected-agency-lookup';
import { VerifiedName } from '@/components/common/VerifiedBadge';
import { cn } from '@/lib/utils';
import type { InventoryPageMeta } from '@/types/inventory.types';
import type {
  StockRequestDirection,
  StockRequestDto,
  StockRequestStatus,
} from '@/types/stock-requests.types';
import { useApiError, useFormatters, useTranslation } from '@/i18n';

const PAGE_LIMIT = 20;
const EMPTY_META: InventoryPageMeta = { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 };

export interface StockRequestsTabProps {
  /** Bumped by the page to force a reload (e.g. after a bulk update queued rows). */
  refreshToken: number;
  /**
   * Called after anything that could change the "awaiting you" total — a raise,
   * approve, reject or withdraw. The PAGE owns that number (it has to be right
   * before this tab is ever opened, and Radix unmounts inactive tab content), so
   * this only tells it to re-pull.
   */
  onRequestsChanged: () => void;
  /** Bumped when an approve WRITES stock, so alerts/history reload. */
  onStockWritten: () => void;
  /** From `?view=<id>` — opens that request's sheet even if it is not on this page. */
  openRequestId: string | null;
  onOpenRequestIdHandled: () => void;
}

/**
 * The stock-request inbox — one of Inventory's four sub-tab routes.
 *
 * Search is server-side (`?search=`, product title + SKU, since 2026-10-04),
 * debounced, trimmed, and left off the query entirely when empty — the
 * endpoint rejects an empty or unknown parameter with a 400. It combines with
 * the filters, and every change resets to page 1.
 *
 * One deviation from the app's list conventions:
 *  - Plain pagination on mobile instead of `useInfiniteList` +
 *    `MobileListFooter`: that footer is fixed-position and would sit under the
 *    three sibling surfaces too, and an infinite sentinel next to three
 *    paginated siblings reads as inconsistent.
 */
export function StockRequestsTab({
  refreshToken,
  onRequestsChanged,
  onStockWritten,
  openRequestId,
  onOpenRequestIdHandled,
}: StockRequestsTabProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const isMobile = useIsMobile();

  const [rows, setRows] = useState<StockRequestDto[]>([]);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState<StockRequestStatus | undefined>();
  const [direction, setDirection] = useState<StockRequestDirection | undefined>();
  const [variantId, setVariantId] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const next = search.trim().slice(0, 100);
    if (next === debouncedSearch) return;
    const id = setTimeout(() => {
      setDebouncedSearch(next);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [search, debouncedSearch]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseSeed, setRaiseSeed] = useState<RaiseStockRequestSeed | null>(null);

  // Splice the authoritative DTO back in rather than refetching the page — the
  // hook hands us the server's truth even on a recovered conflict. The page
  // still re-pulls its badge total, which this list cannot know.
  const handleChanged = useCallback(
    (dto: StockRequestDto) => {
      setRows((prev) => prev.map((r) => (r.id === dto.id ? dto : r)));
      onRequestsChanged();
    },
    [onRequestsChanged],
  );

  const actions = useStockRequestActions({
    onChanged: handleChanged,
    onStockWritten,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStockRequests({
        page,
        limit: PAGE_LIMIT,
        status,
        direction,
        variantId,
        search: debouncedSearch || undefined,
      });
      setRows(res.data);
      setMeta({
        page: res.meta.page,
        limit: res.meta.limit,
        total: res.meta.total,
        totalPages: res.meta.totalPages,
      });
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'inventory.requests.errors.loadFailed' }));
      setRows([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [page, status, direction, variantId, debouncedSearch, apiError, refreshToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep-link from a notification. The sheet fetches the request itself, so it
  // works for one that is not on this page (and may already be terminal).
  useEffect(() => {
    if (!openRequestId) return;
    setDetailId(openRequestId);
    onOpenRequestIdHandled();
  }, [openRequestId, onOpenRequestIdHandled]);

  const statusOptions: FilterOption<StockRequestStatus>[] = STOCK_REQUEST_STATUSES.map((s) => ({
    value: s,
    labelKey: STATUS_LABEL_KEYS[s],
  }));
  const directionOptions: FilterOption<StockRequestDirection>[] = STOCK_REQUEST_DIRECTIONS.map(
    (d) => ({ value: d, labelKey: DIRECTION_LABEL_KEYS[d] }),
  );

  const activeFilterCount = [status, direction, variantId].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setStatus(undefined);
    setDirection(undefined);
    setVariantId(undefined);
    setPage(1);
  }, []);

  const activeChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (status) {
      chips.push({
        key: `status:${status}`,
        label: t(STATUS_LABEL_KEYS[status]),
        onRemove: () => {
          setStatus(undefined);
          setPage(1);
        },
      });
    }
    if (direction) {
      chips.push({
        key: `direction:${direction}`,
        label: t(DIRECTION_LABEL_KEYS[direction]),
        onRemove: () => {
          setDirection(undefined);
          setPage(1);
        },
      });
    }
    if (variantId) {
      // Labelled with the SKU we already hold — an ObjectId is not something a
      // human types, so this filter only ever arrives from a caller.
      const sku = rows.find((r) => r.variantId === variantId)?.product?.sku;
      chips.push({
        key: `variant:${variantId}`,
        label: t('inventory.requests.filters.variant', { sku: sku ?? shortVariantId(variantId) }),
        onRemove: () => {
          setVariantId(undefined);
          setPage(1);
        },
      });
    }
    return chips;
  }, [status, direction, variantId, rows, t]);

  const openRaise = (seed: RaiseStockRequestSeed | null) => {
    setRaiseSeed(seed);
    setRaiseOpen(true);
  };

  // The DTO carries `agencyId` only — the name (and verified badge) comes from
  // the vendor's active connections, best-effort like the storage invoices tab.
  const agencies = useConnectedAgencyLookup(rows.map((r) => r.agencyId));


  const detailSeed = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  const raiseButton = isMobile ? (
    <Button
      size="icon"
      className="h-11 w-11 shrink-0 rounded-xl"
      onClick={() => openRaise(null)}
      aria-label={t('inventory.requests.raise.action')}
    >
      <Plus className="h-4 w-4" />
    </Button>
  ) : (
    <Button className="h-11 shrink-0 gap-1.5 rounded-xl" onClick={() => openRaise(null)}>
      <Plus className="h-4 w-4" /> {t('inventory.requests.raise.action')}
    </Button>
  );

  const header = (
    <div className="space-y-2">
      {/* Search, filter and "Propose a change" share one row: the search field
          takes the free width and the two controls sit at h-11 beside it, so
          all three keep a single baseline down to the narrowest phone. */}
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('inventory.requests.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
        filterLabel={t('inventory.requests.filterTitle')}
        trailing={raiseButton}
      />
      <ActiveFilterChips chips={activeChips} onClearAll={clearFilters} />
    </div>
  );

  const emptyNode = (
    <div className="py-12 text-center">
      <PackageSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">
        {debouncedSearch
          ? t('inventory.requests.empty.searched')
          : activeFilterCount > 0
            ? t('inventory.requests.empty.filtered')
            : t('inventory.requests.empty.none')}
      </p>
      {activeFilterCount === 0 && !debouncedSearch && (
        <>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t('inventory.requests.empty.noneHint')}
          </p>
          <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => openRaise(null)}>
            <Plus className="h-4 w-4" /> {t('inventory.requests.raise.action')}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {header}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
              <span className="sr-only">{t('common.a11y.loading')}</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-6 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-2">
                <p>{error}</p>
                <Button size="sm" variant="outline" onClick={load}>
                  {t('common.actions.retry')}
                </Button>
              </div>
            </div>
          ) : rows.length === 0 ? (
            emptyNode
          ) : isMobile ? (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="space-y-2 p-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setDetailId(r.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <StockRequestProduct request={r} />
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-2">
                      <ChangeCell request={r} />
                    </div>
                    <HeldAt request={r} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {raisedByLabel(r, agencies, t)} · {fmt.dateTime(r.requestedAt)}
                    </p>
                  </button>
                  <StockRequestActions
                    request={r}
                    pendingKey={actions.pendingKey}
                    onApprove={actions.approve}
                    onReject={actions.reject}
                    onWithdraw={actions.withdraw}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.requests.columns.product')}</TableHead>
                  <TableHead>{t('inventory.requests.columns.change')}</TableHead>
                  <TableHead>{t('inventory.requests.columns.raisedBy')}</TableHead>
                  <TableHead>{t('inventory.requests.columns.status')}</TableHead>
                  <TableHead>{t('inventory.requests.columns.when')}</TableHead>
                  <TableHead className="text-right">
                    {t('inventory.requests.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(r.id)}
                  >
                    <TableCell className="max-w-[18rem]">
                      <StockRequestProduct request={r} />
                      <HeldAt request={r} className="pl-[3.25rem]" />
                    </TableCell>
                    <TableCell>
                      <ChangeCell request={r} />
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm">{raisedByLabel(r, agencies, t)}</TableCell>
                    <TableCell>
                      <StatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmt.dateTime(r.requestedAt)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <StockRequestActions
                        request={r}
                        pendingKey={actions.pendingKey}
                        onApprove={actions.approve}
                        onReject={actions.reject}
                        onWithdraw={actions.withdraw}
                        className="flex flex-wrap items-center justify-end gap-2"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <InventoryPagination meta={meta} page={page} onPage={setPage} loading={loading} />
        </CardContent>
      </Card>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={activeFilterCount}
        onClear={clearFilters}
      >
        <FilterSection title={t('inventory.requests.filters.status')}>
          {/* No status filter deliberately returns EVERY status, terminal rows
              included, so a SKU's negotiation history stays fetchable. */}
          <FilterChips
            options={statusOptions}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            allLabel={t('inventory.requests.filters.anyStatus')}
          />
        </FilterSection>
        <FilterSection title={t('inventory.requests.filters.direction')}>
          <FilterChips
            options={directionOptions}
            value={direction}
            onChange={(v) => {
              setDirection(v);
              setPage(1);
            }}
            allLabel={t('inventory.requests.filters.bothDirections')}
          />
        </FilterSection>
      </FilterSheet>

      <StockRequestDetailSheet
        requestId={detailId}
        seed={detailSeed}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        pendingKey={actions.pendingKey}
        onApprove={actions.approve}
        onReject={actions.reject}
        onWithdraw={actions.withdraw}
        onFilterByVariant={(vid) => {
          // "One SKU's whole history" — no status filter, so terminal rows are
          // included, which is the whole point of looking.
          setDetailId(null);
          setStatus(undefined);
          setDirection(undefined);
          setVariantId(vid);
          setPage(1);
        }}
      />

      <RaiseStockRequestDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        seed={raiseSeed}
        onRaised={() => {
          void load();
          onRequestsChanged();
        }}
        onOpenExisting={(id) => setDetailId(id)}
      />
    </div>
  );
}

// ─── Row pieces ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: StockRequestStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn('gap-1.5 shrink-0', STATUS_BADGE_CLASSES[status])}>
      <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASSES[status])} />
      {t(STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

/**
 * `quantityBefore → requestedQuantity`, plus the drift line.
 *
 * Drift (`currentQuantity` moved since the proposal) is not an error — the
 * request names an absolute target, so drift changes *what gets replaced*, not
 * whether the request still makes sense. It is also the one thing an approver
 * has to notice before signing off, so it gets its own line.
 */
function ChangeCell({ request }: { request: StockRequestDto }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const from = request.infiniteBefore
    ? t('inventory.requests.unlimitedBefore')
    : fmt.number(request.quantityBefore);
  const to = request.requestedInfinite
    ? t('inventory.requests.unlimitedBefore')
    : fmt.number(request.requestedQuantity);
  const drifted =
    request.currentQuantity !== null && request.currentQuantity !== request.quantityBefore;

  return (
    <div>
      <p className="text-sm tabular-nums">{t('inventory.requests.change', { from, to })}</p>
      {drifted && (
        <p className="text-xs text-amber-600 tabular-nums">
          {t('inventory.requests.driftNow', { current: fmt.number(request.currentQuantity ?? 0) })}
        </p>
      )}
    </div>
  );
}

/** The agency's depot holding the SKU. Nothing at all when unknown — the list stays quiet. */
function HeldAt({ request, className }: { request: StockRequestDto; className?: string }) {
  const { t } = useTranslation();
  const place = stockRequestPlace(request.location);
  if (!place) return null;
  return (
    <p className={cn('mt-1 truncate text-xs text-muted-foreground', className)}>
      {t('inventory.requests.heldAt', { place })}
    </p>
  );
}

function raisedByLabel(
  request: StockRequestDto,
  agencies: Record<string, ConnectedAgencyIdentity>,
  t: ReturnType<typeof useTranslation>['t'],
): ReactNode {
  if (request.requestedByRole === 'vendor') return t('inventory.requests.raisedByYou');
  const agency = agencies[request.agencyId];
  const name = agency?.name;
  if (!name) return t('inventory.requests.raisedByAgency');
  return (
    <VerifiedName
      name={t('inventory.requests.raisedByNamedAgency', { name })}
      verified={agency?.verified}
      kind="agency"
      badgeClassName="h-3.5 w-3.5"
    />
  );
}

export default StockRequestsTab;
