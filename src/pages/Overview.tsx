import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Wallet,
  ArrowRight,
  Package,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsStore, useOrderStore, useStoreStore } from '@/store';
import { SalesChart } from '@/components/features/SalesChart';
import { TopProductsList } from '@/components/features/TopProductsList';
import { DateRangePicker } from '@/components/features/DateRangePicker';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { MobileOrderDetailSheet } from '@/components/orders/MobileOrderDetailSheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from '@/App';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/components/customers/customer.constants';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import type { Order } from '@/types';
import type { StockAlert } from '@/types/inventory.types';
import { toast } from 'sonner';
import { getOrderErrorMessage } from '@/services/orders.service';
import { fetchStockAlerts } from '@/services/inventory.service';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ElementType;
  isLoading?: boolean;
}

function MetricCard({ title, value, change, changeType, icon: Icon, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card className="group transition-all hover:shadow-lg hover:-translate-y-0.5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-display font-bold tracking-tight tabular-nums">{value}</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                    changeType === 'increase' && 'bg-success/15 text-success',
                    changeType === 'decrease' && 'bg-destructive/15 text-destructive',
                    changeType === 'neutral' && 'bg-muted text-muted-foreground'
                  )}
                >
                  {changeType === 'increase' ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : changeType === 'decrease' ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : null}
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-xs text-muted-foreground">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15">
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Low-stock widget ─────────────────────────────────────────────────────────
// Self-contained: pulls the first page of low-stock alerts and links to the full
// Inventory page. Non-critical, so load errors fail quietly (Inventory surfaces them).

const LOW_STOCK_PREVIEW = 5;

function LowStockWidget() {
  const { navigate } = useRouter();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchStockAlerts({ page: 1, limit: LOW_STOCK_PREVIEW });
        if (!active) return;
        setAlerts(res.data);
        setTotal(res.meta.total);
      } catch {
        if (active) setAlerts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock
          </CardTitle>
          <CardDescription>Variants at or below their threshold</CardDescription>
        </div>
        {total > 0 && <Badge variant="destructive">{total}</Badge>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            All variants are above their stock thresholds.
          </p>
        ) : (
          <div className="space-y-0">
            {alerts.map((a) => {
              const out = a.availableStock <= 0;
              return (
                <div key={a.variantId} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.productTitle}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{a.sku}</p>
                  </div>
                  <Badge variant={out ? 'destructive' : 'secondary'} className={cn('flex-shrink-0', !out && 'text-amber-600')}>
                    {out ? 'Out of stock' : `${a.availableStock} left`}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
        {!loading && (
          <Button variant="outline" size="sm" className="w-full mt-3 gap-1" onClick={() => navigate('inventory')}>
            Manage inventory <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function Overview() {
  const { metrics, salesData, topProducts, dateRange, setDateRange, fetchAnalytics, isLoading, notReady } = useAnalyticsStore();
  const { orders, fetchOrders, isLoading: isOrderLoading, fetchOrderById } = useOrderStore();
  const { store } = useStoreStore();
  const { navigate } = useRouter();
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(isOrderLoading);

  // Re-runs whenever the selected date range changes (fetchAnalytics is
  // re-memoized on range change in the store).
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchOrders({ limit: 5 });
  }, [fetchOrders]);


  const handleViewDetails = async (order: Order) => {
    setIsDetailLoading(true);
    setSelectedOrder(order);
    setOrderSheetOpen(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const full = await fetchOrderById(order.id);
      setSelectedOrder(full);
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
      setOrderSheetOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Analytics metrics carry no currency (platform default XAF); order rows do —
  // pass order.currency at those call sites. Uses the shared currency-aware formatter.
  const formatCurrency = (value: number, currency?: string) => formatMoney(value, currency);

  // ─── Mobile Layout ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="space-y-4 pt-2">
        {/* Greeting */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {store?.logo?.url ? (
              <img
                src={store.logo.url}
                alt={store.name}
                crossOrigin="use-credentials"
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Welcome back</p>
              <h1 className="text-xl font-bold truncate">{store?.name ?? 'My Store'}</h1>
            </div>
          </div>
          {store?.publicUrl && (
            <a
              href={store.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1.5 bg-background hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              My Store
            </a>
          )}
        </div>

        {/* Date range */}
        <div className="flex justify-end">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Data-not-ready notice (backend 503 AGGREGATION_NOT_READY) */}
        {notReady && !isLoading && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 p-4 text-amber-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">
                Analytics for this period aren&apos;t ready yet. Please check back shortly.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Total sales card with sparkline */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total sales · {dateRange.label}</p>
                <p className="text-3xl font-display font-bold tracking-tight tabular-nums mt-1">
                  {formatCurrency(metrics.totalSales.value)}
                </p>
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  metrics.totalSales.changeType === 'increase' && 'text-green-600',
                  metrics.totalSales.changeType === 'decrease' && 'text-red-600',
                  metrics.totalSales.changeType === 'neutral' && 'text-muted-foreground'
                )}
              >
                {metrics.totalSales.changeType === 'increase' ? '↗ +' : metrics.totalSales.changeType === 'decrease' ? '↘ ' : ''}
                {metrics.totalSales.change}%
              </span>
            </div>
            {salesData.length > 0 && (
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mobileSparkline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#059669"
                      strokeWidth={2}
                      fill="url(#mobileSparkline)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2-col stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="text-2xl font-bold mt-1">{metrics.totalOrders.value}</p>
              <p
                className={cn(
                  'text-xs mt-1',
                  metrics.totalOrders.changeType === 'increase' && 'text-green-600',
                  metrics.totalOrders.changeType === 'decrease' && 'text-red-600',
                  metrics.totalOrders.changeType === 'neutral' && 'text-muted-foreground'
                )}
              >
                {metrics.totalOrders.changeType === 'increase' ? '↗ +' : metrics.totalOrders.changeType === 'decrease' ? '↘ ' : ''}
                {metrics.totalOrders.change}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Avg. order</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(metrics.averageOrderValue.value)}
              </p>
              <p
                className={cn(
                  'text-xs mt-1',
                  metrics.averageOrderValue.changeType === 'increase' && 'text-green-600',
                  metrics.averageOrderValue.changeType === 'decrease' && 'text-red-600',
                  metrics.averageOrderValue.changeType === 'neutral' && 'text-muted-foreground'
                )}
              >
                {metrics.averageOrderValue.changeType === 'increase' ? '↗ +' : metrics.averageOrderValue.changeType === 'decrease' ? '↘ ' : ''}
                {metrics.averageOrderValue.change}%
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Net revenue</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(metrics.netRevenue.value)}
              </p>
              <p
                className={cn(
                  'text-xs mt-1',
                  metrics.netRevenue.changeType === 'increase' && 'text-green-600',
                  metrics.netRevenue.changeType === 'decrease' && 'text-red-600',
                  metrics.netRevenue.changeType === 'neutral' && 'text-muted-foreground'
                )}
              >
                {metrics.netRevenue.changeType === 'increase' ? '↗ +' : metrics.netRevenue.changeType === 'decrease' ? '↘ ' : ''}
                {metrics.netRevenue.change}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top products */}
        <div>
          <h2 className="font-semibold mb-2">Top products</h2>
          <Card>
            <CardContent className="p-2">
              <TopProductsList products={topProducts} isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>

        {/* Recent orders */}
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Recent orders</h2>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('orders')}>
            View all
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        <div>
          {orders.map((order: Order) => (
            <button
              key={order.id}
              onClick={() => { handleViewDetails(order) }}
              // onClick={() => { setSelectedOrder(order); setOrderSheetOpen(true); }}
              className="w-full flex items-center gap-3 py-3 border-b hover:bg-muted/30 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <p className="font-medium text-sm">{order.orderNumber}</p>
                  <p className="font-semibold text-sm">{formatCurrency(order.total, order.currency)}</p>
                </div>
                <div className="flex justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {order.customer.name} · {order.items.length} items
                  </p>
                  <OrderStatusBadge status={order.status} size="xs" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Low Stock Alert */}
        <LowStockWidget />

        <MobileOrderDetailSheet
          order={selectedOrder}
          open={orderSheetOpen}
          isDetailLoading={isDetailLoading}
          onOpenChange={setOrderSheetOpen}
        />
      </div>
    );
  }

  // ─── Desktop Layout ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s what&apos;s happening with your store.
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Data-not-ready notice (backend 503 AGGREGATION_NOT_READY) */}
      {notReady && !isLoading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4 text-amber-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">
              Analytics for this period aren&apos;t ready yet. Data is aggregated daily — please
              check back shortly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI cards — 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sales"
          value={formatCurrency(metrics.totalSales.value)}
          change={metrics.totalSales.change}
          changeType={metrics.totalSales.changeType}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders.value.toString()}
          change={metrics.totalOrders.change}
          changeType={metrics.totalOrders.changeType}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <MetricCard
          title="Net Revenue"
          value={formatCurrency(metrics.netRevenue.value)}
          change={metrics.netRevenue.change}
          changeType={metrics.netRevenue.changeType}
          icon={Wallet}
          isLoading={isLoading}
        />
        <MetricCard
          title="Average Order Value"
          value={formatCurrency(metrics.averageOrderValue.value)}
          change={metrics.averageOrderValue.change}
          changeType={metrics.averageOrderValue.changeType}
          icon={Users}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row — 65% / 35% split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Sales Performance</CardTitle>
              <CardDescription>Daily sales and order trends</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-foreground" />
                Sales
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Orders
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best sellers by revenue this period</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsList products={topProducts} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row — 60% / 40% split (3 + 2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Orders — col-span-3 */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest orders from your customers</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {orders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors rounded"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customer.name} · {order.items.length} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{formatCurrency(order.total, order.currency)}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right column — Quick Actions + Low Stock */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you might want to perform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                  <Package className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Add Product</p>
                    <p className="text-xs text-muted-foreground">Create new listing</p>
                  </div>
                </button>
                <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                  <RefreshCw className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Process Refund</p>
                    <p className="text-xs text-muted-foreground">Handle returns</p>
                  </div>
                </button>
                <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                  <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Abandoned Carts</p>
                    <p className="text-xs text-muted-foreground">12 need attention</p>
                  </div>
                </button>
                <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                  <TrendingUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">View Reports</p>
                    <p className="text-xs text-muted-foreground">Analytics & insights</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock */}
          <LowStockWidget />
        </div>
      </div>
    </div>
  );
}
