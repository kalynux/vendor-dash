import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  CreditCard,
  Plus,
  Loader2,
  PackageSearch,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
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
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { fetchOrders as apiFetchOrders, getOrderErrorMessage } from '@/services/orders.service';
import { toast } from 'sonner';
import { OrderDetails } from '@/components/features/OrderDetails';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { MobileOrderDetailSheet } from '@/components/orders/MobileOrderDetailSheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { MobileListFooter } from '@/components/layout/MobileListFooter';
import type { Order } from '@/types';
import { cn } from '@/lib/utils';

const statusOptions = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500' },
  { value: 'processing', label: 'Processing', color: 'bg-purple-500' },
  { value: 'shipped', label: 'Shipped', color: 'bg-indigo-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
  { value: 'refunded', label: 'Refunded', color: 'bg-gray-500' },
];

// Valid next statuses based on current status and order type
export function getNextStatuses(status: string, orderType: 'physical' | 'digital'): string[] {
  switch (status) {
    case 'pending': return ['processing', 'cancelled'];
    case 'processing': return orderType === 'digital' ? ['fulfilled', 'cancelled'] : ['shipped', 'cancelled'];
    case 'shipped': return ['delivered', 'cancelled'];
    default: return []; // delivered, fulfilled, cancelled are terminal
  }
}

export const STATUS_LABELS: Record<string, string> = {
  processing: 'Mark as Processing',
  shipped: 'Mark as Shipped',
  delivered: 'Mark as Delivered',
  fulfilled: 'Mark as Fulfilled',
  cancelled: 'Cancel Order',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  processing: <PackageSearch className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle className="w-4 h-4" />,
  fulfilled: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4 text-destructive" />,
};

const mobileFilterPills = ['All', 'Pending', 'Shipped', 'Delivered'];

export function Orders() {
  const { orders, selectedOrders, isLoading, pagination, fetchOrders, fetchOrderById, toggleOrderSelection, selectAllOrders, updateOrderStatus } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [mobilePillFilter, setMobilePillFilter] = useState('All');
  const isMobile = useIsMobile();

  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelConfirmationText, setCancelConfirmationText] = useState('');
  const [actionsSheetOrder, setActionsSheetOrder] = useState<Order | null>(null);

  useScrollRestoration('orders');

  // Desktop uses the store + page-number pagination; mobile uses infinite scroll.
  // Only fetch on mount when the store is empty so returning to the tab (or back
  // from a detail) doesn't reload data that's already there.
  useEffect(() => {
    if (!isMobile && orders.length === 0) fetchOrders({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Debounce search for the mobile server-side fetch.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const fetchOrdersPage = useCallback(
    (page: number, limit: number) =>
      apiFetchOrders({
        page,
        limit,
        q: debouncedSearch || undefined,
        status: mobilePillFilter === 'All' ? undefined : mobilePillFilter.toLowerCase(),
      }).then((r) => ({ items: r.data, total: r.meta.total, totalPages: r.meta.pages })),
    [debouncedSearch, mobilePillFilter],
  );

  const infinite = useInfiniteList<Order>({
    fetchPage: fetchOrdersPage,
    rowHeight: 84,
    enabled: isMobile,
    deps: [debouncedSearch, mobilePillFilter],
    cacheKey: 'orders',
  });

  const filteredOrders = orders.filter((order: Order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(order.status);

    const matchesMobilePill =
      mobilePillFilter === 'All' ||
      order.status.toLowerCase() === mobilePillFilter.toLowerCase();

    return matchesSearch && matchesStatus && (isMobile ? matchesMobilePill : true);
  });

  const handleStatusUpdate = async (order: Order, status: string) => {
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

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const getPaymentBadge = (status: string) => {
    return (
      <Badge
        variant={status === 'paid' ? 'default' : 'secondary'}
        className={cn('capitalize', status === 'paid' && 'bg-black text-white hover:bg-black/90')}
      >
        {status}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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

  const allSelected = filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length;

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

  // ─── Mobile Layout ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
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
          subheader={
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 scrollbar-none">
                {mobileFilterPills.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setMobilePillFilter(pill)}
                    className={cn(
                      'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                      mobilePillFilter === pill
                        ? 'bg-black text-white border-black'
                        : 'bg-background border-border'
                    )}
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>
          }
        />

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
                  onClick={() => handleViewDetails(order)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleViewDetails(order);
                    }
                  }}
                  className="w-full px-4 py-3 border-b hover:bg-muted/30 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={order.customer.avatar || `https://i.pravatar.cc/150?u=${order.customer.id}`}
                      alt={order.customer.name}
                      className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <p className="font-semibold text-sm">{order.orderNumber}</p>
                        <p className="font-semibold text-sm">{formatCurrency(order.total)}</p>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground">{order.customer.name}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(order.createdAt)}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <OrderStatusBadge status={order.status} />
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
                        <p className="text-xs text-muted-foreground">{order.items.length} items</p>
                      </div>
                    </div>
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
              const nexts = getNextStatuses(o.status, o.orderType);
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
                    {nexts.map((s) => {
                      const icons: Record<string, React.ReactNode> = {
                        processing: <PackageSearch className="w-5 h-5" />,
                        shipped: <Truck className="w-5 h-5" />,
                        delivered: <CheckCircle className="w-5 h-5" />,
                        fulfilled: <CheckCircle className="w-5 h-5" />,
                        cancelled: <XCircle className="w-5 h-5" />,
                      };
                      return (
                        <SheetActionButton
                          key={s}
                          icon={icons[s]}
                          label={STATUS_LABELS[s] ?? s}
                          destructive={s === 'cancelled'}
                          onClick={() => { close(); handleStatusUpdate(o, s); }}
                        />
                      );
                    })}
                    {nexts.length === 0 && (
                      <p className="px-5 py-3 text-sm text-muted-foreground">
                        No further status changes available.
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {cancelOrderDialog}
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
      <Card className="border-none shadow-none">
        <CardContent className="border-none p-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by number, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                  {statusFilter.length > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {statusFilter.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader className="border-b-2">
                  <SheetTitle>Filter Orders</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 p-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Order Status</h4>
                    <div className="space-y-2">
                      {statusOptions.map((status) => (
                        <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={statusFilter.includes(status.value)}
                            onCheckedChange={() => toggleStatusFilter(status.value)}
                          />
                          <span className="capitalize">{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {selectedOrders.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 border-b">
              <span className="text-sm text-muted-foreground">
                {selectedOrders.length} selected
              </span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="gap-2">
                <Truck className="w-4 h-4" />
                Mark as Shipped
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Mark as Delivered
              </Button>
              <Button variant="destructive" size="sm" className="gap-2">
                <XCircle className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllOrders(filteredOrders.map((o: Order) => o.id));
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
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No orders found</p>
                        <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter([]); }}>
                          Clear filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order: Order) => (
                    <tr
                      key={order.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
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
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          {getPaymentBadge(order.paymentStatus)}
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="p-4">
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
                            {/* <DropdownMenuItem>
                              <Truck className="w-4 h-4 mr-2" />
                              Mark as Shipped
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel Order
                            </DropdownMenuItem> */}
                            {getNextStatuses(order.status, order.orderType).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => handleStatusUpdate(order, s)}
                                className={s === 'cancelled' ? 'text-destructive' : ''}
                              >
                                {STATUS_ICONS[s]}
                                {statusLoading == order.status ? <Loader2 className="w-4 h-4 animate-spin" /> : STATUS_LABELS[s] ?? s}
                              </DropdownMenuItem>
                            ))}
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
                : `Showing ${filteredOrders.length} orders`}
            </p>
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => fetchOrders({ page: pagination.page - 1 })}
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
                    onClick={() => fetchOrders({ page: p })}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages || isLoading}
                  onClick={() => fetchOrders({ page: pagination.page + 1 })}
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
