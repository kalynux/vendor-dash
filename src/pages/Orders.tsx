import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  Eye,
  Calendar,
  CreditCard,
  Plus,
  Loader2,
  AlertTriangle,
  PackageCheck,
  Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/components/customers/customer.constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
  type ActiveFilterChip,
} from '@/components/filters';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrderStore } from '@/store';
import {
  fetchOrders as apiFetchOrders,
  dispatchOrder,
  bulkUpdateOrderStatus,
  bulkDispatchOrders,
  getOrderErrorMessage,
  isOrderFrozen,
  ORDER_ERROR_LABELS,
  type BulkActionFailure,
} from '@/services/orders.service';
import {
  getNextStatuses,
  STATUS_LABELS,
  STATUS_ICONS,
  ORDER_STATUS_FILTER_OPTIONS,
  PAYMENT_METHOD_FILTER_OPTIONS,
  PAYMENT_STATUS_FILTER_OPTIONS,
  ORDER_TYPE_FILTER_OPTIONS,
  canDispatchOrder,
  getCommonNextStatuses,
  canBulkDispatch,
} from '@/lib/orderStatus';
import {
  parseOrderFilters,
  parseOrderPage,
  orderFiltersToQuery,
  countActiveFilters,
  type OrderFilters,
} from '@/lib/orderFilters';
import { OrderDateRangeFilter } from '@/components/orders/OrderDateRangeFilter';
import { toast } from 'sonner';
import { OrderDetails } from '@/components/features/OrderDetails';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { PaymentStatusBadge } from '@/components/orders/PaymentStatusBadge';
import { MobileOrderDetailSheet } from '@/components/orders/MobileOrderDetailSheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { MobileListFooter } from '@/components/layout/MobileListFooter';
import type { Order, VendorSettableStatus } from '@/types';
import { cn } from '@/lib/utils';

// Doc-enforced cap on orderIds per bulk/status and bulk/dispatch call.
const MAX_BULK_SIZE = 50;

// Desktop page-number pagination size (mobile uses viewport-derived infinite scroll).
const DESKTOP_PAGE_LIMIT = 20;

/** Short toast-friendly summary of a bulk action's per-order failures. */
function summarizeBulkFailures(failed: BulkActionFailure[]): string {
  if (failed.length === 1) {
    return ORDER_ERROR_LABELS[failed[0].code] ?? failed[0].reason;
  }
  const codes = new Set(failed.map((f) => f.code));
  if (codes.size === 1) {
    const [code] = codes;
    return `${failed.length} order(s) failed: ${ORDER_ERROR_LABELS[code] ?? code}`;
  }
  return `${failed.length} order(s) couldn't be updated — see each order for details.`;
}

// ─── Filter UI (shared by desktop + mobile sheets) ──────────────────────────

function labelFor<T extends string>(options: { value: T; label: string }[], value?: T): string {
  return options.find((o) => o.value === value)?.label ?? String(value ?? '');
}

function formatChipDateRange(from?: string, to?: string): string {
  const f = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null);
  const a = f(from);
  const b = f(to);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a ?? b ?? '';
}

/** Single-select filter sections + date range. Emits URL patches via `onChange`. */
function OrdersFilterPanel({
  filters,
  onChange,
}: {
  filters: OrderFilters;
  onChange: (patch: Partial<OrderFilters>) => void;
}) {
  return (
    <>
      <FilterSection title="Order status">
        <FilterChips
          options={ORDER_STATUS_FILTER_OPTIONS}
          value={filters.status}
          onChange={(v) => onChange({ status: v })}
          allLabel="Any status"
        />
      </FilterSection>
      <FilterSection title="Payment status">
        <FilterChips
          options={PAYMENT_STATUS_FILTER_OPTIONS}
          value={filters.paymentStatus}
          onChange={(v) => onChange({ paymentStatus: v })}
          allLabel="Any"
        />
      </FilterSection>
      <FilterSection title="Payment method">
        <FilterChips
          options={PAYMENT_METHOD_FILTER_OPTIONS}
          value={filters.paymentMethod}
          onChange={(v) => onChange({ paymentMethod: v })}
          allLabel="Any"
        />
      </FilterSection>
      <FilterSection title="Order type">
        <FilterChips
          options={ORDER_TYPE_FILTER_OPTIONS}
          value={filters.orderType}
          onChange={(v) => onChange({ orderType: v })}
          allLabel="Any"
        />
      </FilterSection>
      <FilterSection title="Order date">
        <OrderDateRangeFilter
          from={filters.dateFrom}
          to={filters.dateTo}
          onApply={(from, to) => onChange({ dateFrom: from, dateTo: to })}
        />
      </FilterSection>
    </>
  );
}

/** Active filters as removable chips, shown under the search bar. */
function orderFilterChips(
  filters: OrderFilters,
  orders: Order[],
  onClear: (patch: Partial<OrderFilters>) => void,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const push = (key: string, label: string, clear: Partial<OrderFilters>) =>
    chips.push({ key, label, onRemove: () => onClear(clear) });

  if (filters.status) push('status', `Status: ${labelFor(ORDER_STATUS_FILTER_OPTIONS, filters.status)}`, { status: undefined });
  if (filters.paymentStatus) push('paymentStatus', `Payment: ${labelFor(PAYMENT_STATUS_FILTER_OPTIONS, filters.paymentStatus)}`, { paymentStatus: undefined });
  if (filters.paymentMethod) push('paymentMethod', `Method: ${labelFor(PAYMENT_METHOD_FILTER_OPTIONS, filters.paymentMethod)}`, { paymentMethod: undefined });
  if (filters.orderType) push('orderType', `Type: ${labelFor(ORDER_TYPE_FILTER_OPTIONS, filters.orderType)}`, { orderType: undefined });
  if (filters.dateFrom || filters.dateTo) push('date', `Date: ${formatChipDateRange(filters.dateFrom, filters.dateTo)}`, { dateFrom: undefined, dateTo: undefined });
  if (filters.customerId) {
    const name = orders.find((o) => o.customer.id === filters.customerId)?.customer.name;
    push('customerId', `Customer: ${name ?? filters.customerId}`, { customerId: undefined });
  }
  return chips;
}

export function Orders() {
  const { orders, selectedOrders, isLoading, pagination, fetchOrders, fetchOrderById, toggleOrderSelection, selectAllOrders, updateOrderStatus } = useOrderStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // ─── URL-backed filter state (single source of truth) ──────────────────────
  // Filters live in the query string so they're shareable, survive back/forward,
  // and the `?customerId=` deep-link from the Customers tab works for free.
  const filters = useMemo(() => parseOrderFilters(searchParams), [searchParams]);
  const page = parseOrderPage(searchParams);
  const activeFilterCount = countActiveFilters(filters);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelConfirmationText, setCancelConfirmationText] = useState('');
  const [actionsSheetOrder, setActionsSheetOrder] = useState<Order | null>(null);

  // Merge a filter patch into the URL and reset to page 1. Non-filter params
  // (e.g. `view`) are preserved.
  const updateFilters = useCallback((patch: Partial<OrderFilters>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['status', 'paymentStatus', 'paymentMethod', 'orderType', 'dateFrom', 'dateTo', 'customerId', 'q', 'page'].forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const goToPage = useCallback((p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p <= 1) next.delete('page');
      else next.set('page', String(p));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Bulk actions (desktop selection bar + mobile long-press selection)
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkCancelConfirm, setShowBulkCancelConfirm] = useState(false);
  const [bulkCancelConfirmationText, setBulkCancelConfirmationText] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  useScrollRestoration('orders');

  // Exit mobile selection mode automatically once the last item is deselected.
  useEffect(() => {
    if (selectionMode && selectedOrders.length === 0) setSelectionMode(false);
  }, [selectionMode, selectedOrders]);

  // Deep-link from a notification (`/dashboard/orders?view=<id>`): open that
  // order's detail directly, then strip the param so a refresh/back doesn't
  // reopen it.
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (!viewId) return;
    setSelectedOrder(null);
    setIsDetailsOpen(true);
    setIsDetailLoading(true);
    fetchOrderById(viewId)
      .then((full) => setSelectedOrder(full))
      .catch((err) => {
        toast.error(getOrderErrorMessage(err));
        setIsDetailsOpen(false);
      })
      .finally(() => setIsDetailLoading(false));
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Debounce the search box, then push it into the URL `q` param — the single
  // source of truth both desktop and mobile fetch from.
  const [debouncedSearch, setDebouncedSearch] = useState(() => (searchParams.get('q') ?? '').trim());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debouncedSearch === current) return;
    updateFilters({ q: debouncedSearch || undefined });
  }, [debouncedSearch, searchParams, updateFilters]);

  // Desktop: fetch whenever the URL-derived query (filters + search + page)
  // changes. Mobile is driven by useInfiniteList below instead.
  const query = useMemo(
    () => orderFiltersToQuery(filters, page, DESKTOP_PAGE_LIMIT),
    [filters, page],
  );
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    if (isMobile) return;
    fetchOrders(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, queryKey]);

  // Stale selections must not carry across a changed result set (a bulk action
  // could target rows no longer shown). Filter/search changes clear the
  // selection; plain pagination keeps it.
  const filterSelectionKey = JSON.stringify(filters);
  const selectionResetMounted = useRef(false);
  useEffect(() => {
    if (!selectionResetMounted.current) {
      selectionResetMounted.current = true;
      return;
    }
    selectAllOrders([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSelectionKey]);

  const fetchOrdersPage = useCallback(
    (pageArg: number, limit: number) =>
      apiFetchOrders(orderFiltersToQuery(filters, pageArg, limit))
        .then((r) => ({ items: r.data, total: r.meta.total, totalPages: r.meta.pages })),
    [filters],
  );

  const infinite = useInfiniteList<Order>({
    fetchPage: fetchOrdersPage,
    rowHeight: 84,
    enabled: isMobile,
    deps: [
      filters.status,
      filters.paymentStatus,
      filters.paymentMethod,
      filters.orderType,
      filters.dateFrom,
      filters.dateTo,
      filters.customerId,
      filters.q,
    ],
    cacheKey: 'orders',
  });

  const handleStatusUpdate = async (order: Order, status: VendorSettableStatus) => {
    if (status === 'cancelled') {
      setCancelConfirmationText('');
      setOrderToCancel(order);
      return;
    }
    setStatusLoading(status);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateOrderStatus(order.id, status);
      if (isMobile) infinite.reload();
      toast.success(`Order marked as ${status}`);
      // const next = { ...order, status: status as Order['status'] };
      // setSelectedOrder(next);
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setStatusLoading(null);
    }
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;
    const order = orderToCancel;
    setOrderToCancel(null);
    setCancelConfirmationText('');
    setStatusLoading('cancelled');
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateOrderStatus(order.id, 'cancelled');
      if (isMobile) infinite.reload();
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setStatusLoading(null);
    }
  };

  // Single-row "Dispatch to Agency" (per-row desktop dropdown item / mobile "…" sheet action).
  const handleDispatch = async (order: Order) => {
    setStatusLoading('dispatch');
    try {
      const { message } = await dispatchOrder(order.id);
      if (isMobile) infinite.reload();
      else fetchOrders(query);
      toast.success(message);
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setStatusLoading(null);
    }
  };

  // Bulk actions don't return updated order objects (only ids/counts), so the
  // simplest correct way to reflect the real post-action state is a refetch.
  const refreshAfterBulkAction = () => {
    if (isMobile) infinite.reload();
    else fetchOrders(query);
  };

  const handleBulkStatusUpdate = async (status: VendorSettableStatus) => {
    if (status === 'cancelled') {
      setBulkCancelConfirmationText('');
      setShowBulkCancelConfirm(true);
      return;
    }
    setBulkActionLoading(true);
    try {
      const { message, failed } = await bulkUpdateOrderStatus(selectedOrders, status);
      toast.success(message);
      if (failed.length > 0) toast.error(summarizeBulkFailures(failed));
      selectAllOrders([]);
      refreshAfterBulkAction();
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const confirmBulkCancel = async () => {
    setShowBulkCancelConfirm(false);
    setBulkCancelConfirmationText('');
    setBulkActionLoading(true);
    try {
      const { message, failed } = await bulkUpdateOrderStatus(selectedOrders, 'cancelled');
      toast.success(message);
      if (failed.length > 0) toast.error(summarizeBulkFailures(failed));
      selectAllOrders([]);
      refreshAfterBulkAction();
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDispatch = async () => {
    setBulkActionLoading(true);
    try {
      const { message, failed } = await bulkDispatchOrders(selectedOrders);
      toast.success(message);
      if (failed.length > 0) toast.error(summarizeBulkFailures(failed));
      selectAllOrders([]);
      refreshAfterBulkAction();
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const formatCurrency = (value: number, currency?: string) => formatMoney(value, currency);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
    setIsDetailLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const full = await fetchOrderById(order.id);
      setSelectedOrder(full);
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
      setIsDetailsOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // ─── Mobile long-press → multi-select ───────────────────────────────────────
  const LONG_PRESS_MS = 500;

  const startLongPress = (order: Order) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setSelectionMode(true);
      toggleOrderSelection(order.id);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Fires on tap (the click synthesized right after touchend). If a long-press
  // just triggered selection mode, this tap is swallowed instead of also
  // opening the detail sheet.
  const handleCardTap = (order: Order) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode) toggleOrderSelection(order.id);
    else handleViewDetails(order);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    selectAllOrders([]);
  };

  const allSelected = orders.length > 0 && selectedOrders.length === orders.length;

  const cancelOrderDialog = (
    <Dialog open={!!orderToCancel} onOpenChange={(open) => {
      if (!open) {
        setOrderToCancel(null);
        setCancelConfirmationText('');
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle>Cancel Order?</DialogTitle>
          </div>
          <DialogDescription className="pt-3 space-y-3" asChild>
            <div>
              <p className="text-foreground">
                Are you sure you want to cancel order <span className="font-semibold text-foreground">{orderToCancel?.orderNumber}</span>? This action cannot be undone and will notify the customer.
              </p>
              <div className="space-y-2 pt-2">
                <label htmlFor="cancel-confirm-input" className="text-xs font-semibold text-muted-foreground block">
                  Please type <span className="font-bold text-destructive">cancel</span> to confirm:
                </label>
                <Input
                  id="cancel-confirm-input"
                  placeholder='Type "cancel"'
                  value={cancelConfirmationText}
                  onChange={(e) => setCancelConfirmationText(e.target.value)}
                  className="h-9 border-red-200 focus-visible:ring-red-500"
                  autoComplete="off"
                />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex sm:justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline">Keep Order</Button>
          </DialogClose>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white font-medium focus:ring-red-500"
            disabled={cancelConfirmationText.trim().toLowerCase() !== 'cancel'}
            onClick={confirmCancelOrder}
          >
            Yes, Cancel Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const bulkCancelDialog = (
    <Dialog open={showBulkCancelConfirm} onOpenChange={(open) => {
      if (!open) {
        setShowBulkCancelConfirm(false);
        setBulkCancelConfirmationText('');
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle>Cancel {selectedOrders.length} Orders?</DialogTitle>
          </div>
          <DialogDescription className="pt-3 space-y-3" asChild>
            <div>
              <p className="text-foreground">
                Are you sure you want to cancel <span className="font-semibold text-foreground">{selectedOrders.length} selected order(s)</span>? This action cannot be undone and will notify each customer.
              </p>
              <div className="space-y-2 pt-2">
                <label htmlFor="bulk-cancel-confirm-input" className="text-xs font-semibold text-muted-foreground block">
                  Please type <span className="font-bold text-destructive">cancel</span> to confirm:
                </label>
                <Input
                  id="bulk-cancel-confirm-input"
                  placeholder='Type "cancel"'
                  value={bulkCancelConfirmationText}
                  onChange={(e) => setBulkCancelConfirmationText(e.target.value)}
                  className="h-9 border-red-200 focus-visible:ring-red-500"
                  autoComplete="off"
                />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex sm:justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline">Keep Orders</Button>
          </DialogClose>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white font-medium focus:ring-red-500"
            disabled={bulkCancelConfirmationText.trim().toLowerCase() !== 'cancel'}
            onClick={confirmBulkCancel}
          >
            Yes, Cancel {selectedOrders.length} Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Search + filters (identical on desktop and mobile) ───────────────────
  const ordersFilterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title="Filter orders"
      activeCount={activeFilterCount}
      onClear={clearAllFilters}
      applyLabel="Show orders"
    >
      <OrdersFilterPanel filters={filters} onChange={updateFilters} />
    </FilterSheet>
  );

  const ordersSearchBar = (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search orders…"
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel="Filter orders"
      />
      <ActiveFilterChips
        chips={orderFilterChips(filters, orders, updateFilters)}
        onClearAll={clearAllFilters}
      />
    </div>
  );

  // ─── Mobile Layout ────────────────────────────────────────────────────────
  if (isMobile) {
    const selectedOrderObjects = infinite.items.filter((o) => selectedOrders.includes(o.id));
    const bulkCommonStatuses = getCommonNextStatuses(selectedOrderObjects);
    const bulkDispatchable = canBulkDispatch(selectedOrderObjects);
    const bulkOverLimit = selectedOrders.length > MAX_BULK_SIZE;
    const hasBulkActions = !bulkOverLimit && (bulkDispatchable || bulkCommonStatuses.length > 0);

    return (
      <div className="-mx-6 -mt-6">
        {selectionMode ? (
          <MobilePageHeader
            title={`${selectedOrders.length} selected`}
            onBack={exitSelectionMode}
            actions={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectAllOrders(infinite.items.map((o) => o.id))}
                  className="px-3 h-9 flex items-center justify-center rounded-full hover:bg-accent transition-colors text-sm font-medium"
                >
                  Select all
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={selectedOrders.length === 0 || bulkActionLoading}
                      aria-label="Bulk actions"
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {bulkActionLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <MoreHorizontal className="w-5 h-5" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    {bulkOverLimit ? (
                      <div className="px-2 py-1.5 text-xs text-destructive">
                        Select up to {MAX_BULK_SIZE} orders to act in bulk.
                      </div>
                    ) : hasBulkActions ? (
                      <>
                        {bulkDispatchable && (
                          <DropdownMenuItem onClick={handleBulkDispatch}>
                            <PackageCheck className="w-4 h-4" />
                            Dispatch
                          </DropdownMenuItem>
                        )}
                        {bulkCommonStatuses.map((s) => {
                          const Icon = STATUS_ICONS[s];
                          return (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => handleBulkStatusUpdate(s)}
                              className={s === 'cancelled' ? 'text-destructive' : ''}
                            >
                              <Icon className="w-4 h-4" />
                              {STATUS_LABELS[s] ?? s}
                            </DropdownMenuItem>
                          );
                        })}
                      </>
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No common action available for this selection.
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        ) : (
          <MobilePageHeader
            title="Orders"
            actions={
              <button
                type="button"
                onClick={() => {/* create order */ }}
                aria-label="Create order"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            }
            subheader={ordersSearchBar}
          />
        )}

        {/* Order cards */}
        <div className="pb-28">
          {infinite.loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted animate-pulse rounded w-2/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))
          ) : infinite.error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertTriangle className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{infinite.error}</p>
              <Button variant="outline" size="sm" onClick={infinite.reload}>Try again</Button>
            </div>
          ) : infinite.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <>
              {infinite.items.map((order: Order) => (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onTouchStart={() => startLongPress(order)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  onClick={() => handleCardTap(order)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardTap(order);
                    }
                  }}
                  className={cn(
                    'w-full px-4 py-3 border-b hover:bg-muted/30 transition-colors text-left cursor-pointer',
                    selectionMode && selectedOrders.includes(order.id) && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {selectionMode && (
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                        className="mt-2 flex-shrink-0"
                      />
                    )}
                    <img
                      src={order.customer.avatar || `https://i.pravatar.cc/150?u=${order.customer.id}`}
                      alt={order.customer.name}
                      className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-sm truncate">{order.orderNumber}</p>
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full flex-shrink-0',
                              order.orderType === 'digital' ? 'bg-violet-500' : 'bg-blue-500',
                            )}
                          />
                          <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">
                            {order.orderType === 'digital' ? 'Digital' : 'Physical'}
                          </span>
                        </div>
                        <p className="font-semibold text-sm flex-shrink-0">{formatCurrency(order.total, order.currency)}</p>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground">{order.customer.name}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(order.createdAt)}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <OrderStatusBadge status={order.status} size="xs" />
                          <PaymentStatusBadge status={order.paymentStatus} size="xs" />
                          {order.paymentMethod === 'cash_on_delivery' && (
                            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50">
                              <Banknote className="w-2.5 h-2.5" />COD
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{order.items.length} items</p>
                      </div>
                    </div>
                    {!selectionMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionsSheetOrder(order);
                        }}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-accent transition-colors -mr-1 -mt-1"
                        aria-label="Order actions"
                      >
                        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={infinite.sentinelRef} className="h-1" />
              {infinite.loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>

        <MobileListFooter shown={infinite.items.length} total={infinite.total} noun="orders" />

        {/* Order Details Sheet */}
        <MobileOrderDetailSheet
          order={selectedOrder}
          open={isDetailsOpen}
          isDetailLoading={isDetailLoading}
          onOpenChange={setIsDetailsOpen}
        />

        {/* Order Actions Bottom Sheet */}
        <Sheet
          open={!!actionsSheetOrder}
          onOpenChange={(open) => {
            if (!open) setActionsSheetOrder(null);
          }}
        >
          <SheetContent side="bottom" className="p-0">
            {actionsSheetOrder && (() => {
              const o = actionsSheetOrder;
              const frozen = isOrderFrozen(o);
              const nexts = frozen ? [] : getNextStatuses(o.status);
              const close = () => setActionsSheetOrder(null);
              return (
                <>
                  <SheetHeader className="border-b">
                    <SheetTitle className="truncate pr-8 text-base">{o.orderNumber}</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col py-2 pb-6">
                    <SheetActionButton
                      icon={<Eye className="w-5 h-5" />}
                      label="View Details"
                      onClick={() => { close(); handleViewDetails(o); }}
                    />
                    {canDispatchOrder(o) && (
                      <SheetActionButton
                        icon={<PackageCheck className="w-5 h-5" />}
                        label="Dispatch to Agency"
                        onClick={() => { close(); handleDispatch(o); }}
                      />
                    )}
                    {nexts.map((s) => {
                      const Icon = STATUS_ICONS[s];
                      return (
                        <SheetActionButton
                          key={s}
                          icon={<Icon className="w-5 h-5" />}
                          label={STATUS_LABELS[s] ?? s}
                          destructive={s === 'cancelled'}
                          onClick={() => { close(); handleStatusUpdate(o, s); }}
                        />
                      );
                    })}
                    {nexts.length === 0 && (
                      frozen ? (
                        <div className="mx-5 my-2 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
                          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>Payment under dispute — this order is frozen until it settles.</span>
                        </div>
                      ) : (
                        <p className="px-5 py-3 text-sm text-muted-foreground">
                          No further status changes available.
                        </p>
                      )
                    )}
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {ordersFilterSheet}

        {cancelOrderDialog}
        {bulkCancelDialog}
      </div>
    );
  }

  // ─── Desktop Layout ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Package className="w-4 h-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      {ordersSearchBar}
      {ordersFilterSheet}

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {selectedOrders.length > 0 && (() => {
            const selectedOrderObjects = orders.filter((o) => selectedOrders.includes(o.id));
            const commonStatuses = getCommonNextStatuses(selectedOrderObjects);
            const bulkDispatchable = canBulkDispatch(selectedOrderObjects);
            const overLimit = selectedOrders.length > MAX_BULK_SIZE;
            return (
              <div className="flex items-center gap-2 p-4 bg-muted/50 border-b flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {selectedOrders.length} selected
                </span>
                {overLimit && (
                  <span className="text-xs text-destructive">Select up to {MAX_BULK_SIZE} orders to act in bulk</span>
                )}
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => selectAllOrders([])}>
                  Clear
                </Button>
                {!overLimit && bulkDispatchable && (
                  <Button variant="outline" size="sm" className="gap-2" disabled={bulkActionLoading} onClick={handleBulkDispatch}>
                    {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                    Dispatch to Agency
                  </Button>
                )}
                {!overLimit && commonStatuses.map((s) => {
                  const Icon = STATUS_ICONS[s];
                  return (
                    <Button
                      key={s}
                      variant={s === 'cancelled' ? 'destructive' : 'outline'}
                      size="sm"
                      className="gap-2"
                      disabled={bulkActionLoading}
                      onClick={() => handleBulkStatusUpdate(s)}
                    >
                      <Icon className="w-4 h-4" />
                      {STATUS_LABELS[s] ?? s}
                    </Button>
                  );
                })}
                {!overLimit && !bulkDispatchable && commonStatuses.length === 0 && (
                  <span className="text-xs text-muted-foreground">No common action available for this selection.</span>
                )}
              </div>
            );
          })()}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllOrders(orders.map((o: Order) => o.id));
                        } else {
                          selectAllOrders([]);
                        }
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Order</th>
                  <th className="text-left p-4 text-sm font-medium">Customer</th>
                  <th className="text-left p-4 text-sm font-medium">Date</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Payment</th>
                  <th className="text-left p-4 text-sm font-medium">Total</th>
                  <th className="text-left p-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={8} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No orders found</p>
                        {(activeFilterCount > 0 || searchQuery) && (
                          <Button variant="outline" onClick={clearAllFilters}>
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order: Order) => (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      onClick={() => handleViewDetails(order)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleViewDetails(order);
                        }
                      }}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.orderNumber}</span>
                          {order.orderType === 'digital' ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-violet-300 text-violet-700 bg-violet-50 gap-1">
                              <Download className="w-2.5 h-2.5" />Digital
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-300 text-blue-700 bg-blue-50 gap-1">
                              <Package className="w-2.5 h-2.5" />Physical
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {order.items.length} items
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={order.customer.avatar || `https://i.pravatar.cc/150?u=${order.customer.id}`}
                            alt={order.customer.name}
                            className="w-8 h-8 rounded-full"
                          />
                          <div>
                            <div className="font-medium">{order.customer.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.customer.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="p-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <PaymentStatusBadge status={order.paymentStatus} />
                          {order.paymentMethod === 'cash_on_delivery' && (
                            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50">
                              <Banknote className="w-2.5 h-2.5" />COD
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(order.total, order.currency)}
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                              <Eye className="w-4 h-4" />
                              View Details
                            </DropdownMenuItem>
                            {canDispatchOrder(order) && (
                              <DropdownMenuItem onClick={() => handleDispatch(order)}>
                                <PackageCheck className="w-4 h-4" />
                                Dispatch to Agency
                              </DropdownMenuItem>
                            )}
                            {isOrderFrozen(order) ? (
                              <DropdownMenuItem disabled className="text-orange-600">
                                <AlertTriangle className="w-4 h-4" />
                                Frozen — payment disputed
                              </DropdownMenuItem>
                            ) : getNextStatuses(order.status).map((s) => {
                              const Icon = STATUS_ICONS[s];
                              return (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => handleStatusUpdate(order, s)}
                                  className={s === 'cancelled' ? 'text-destructive' : ''}
                                >
                                  <Icon className="w-4 h-4" />
                                  {statusLoading == order.status ? <Loader2 className="w-4 h-4 animate-spin" /> : STATUS_LABELS[s] ?? s}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>

                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              {pagination
                ? `Showing ${orders.length} of ${pagination.total} orders`
                : `Showing ${orders.length} orders`}
            </p>
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className={p === pagination.page ? 'bg-primary text-primary-foreground' : ''}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages || isLoading}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-3xl w-full h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            selectedOrder && <OrderDetails order={selectedOrder} onOrderUpdated={(updated) => setSelectedOrder(updated)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Order Cancellation Warning Dialog */}
      {cancelOrderDialog}
    </div>
  );
}

function SheetActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 text-sm text-left hover:bg-muted active:bg-muted disabled:opacity-50 disabled:pointer-events-none',
        destructive && 'text-destructive',
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
