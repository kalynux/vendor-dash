import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Wallet,
  BarChart3,
  PieChart,
  LineChart,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsStore } from '@/store';
import { SalesChart } from '@/components/features/SalesChart';
import { TopProductsList } from '@/components/features/TopProductsList';
import { DateRangePicker } from '@/components/features/DateRangePicker';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/components/customers/customer.constants';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ElementType;
}

function MetricCard({ title, value, change, changeType, icon: Icon }: MetricCardProps) {
  return (
    <div className="animate-fade-in h-full">
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1 sm:space-y-2">
              {/* On phones the icon rides inline with the label — the badge on the
                  right needs width a half-width tile can't spare. */}
              <p className="flex items-start gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                <Icon className="w-3.5 h-3.5 mt-px flex-shrink-0 sm:hidden" />
                {title}
              </p>
              <p className={cn(METRIC_VALUE_CLASS, 'sm:text-2xl')}>{value}</p>
              <div className="flex items-center gap-1">
                {changeType === 'increase' ? (
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                ) : changeType === 'decrease' ? (
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
                ) : null}
                <span
                  className={cn(
                    'text-xs sm:text-sm font-medium',
                    changeType === 'increase' && 'text-green-500',
                    changeType === 'decrease' && 'text-red-500',
                    changeType === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="hidden sm:inline text-sm text-muted-foreground">vs last period</span>
              </div>
            </div>
            <div className="hidden sm:block p-3 bg-primary/10 rounded-lg flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Mobile 2-up metric grid ──────────────────────────────────────────────────
// The four totals sit 2×2 on phones, but an XAF amount like "1 250 000 FCFA"
// simply doesn't fit in a half-width tile. Rather than truncate or wrap it, we
// measure each formatted value off-screen and fall back to a single column when
// any of them is wider than the room a 2-up tile leaves for text. Measuring the
// *natural* text width (instead of testing the rendered tile for overflow) keeps
// the decision stable — it doesn't change once we've switched to one column, so
// the layout can't oscillate.

/** Typography of the value line at the mobile size — kept in sync with the measurer. */
const METRIC_VALUE_CLASS = 'text-lg font-bold whitespace-nowrap';
/** Tailwind `gap-3` between the two mobile columns. */
const MOBILE_GRID_GAP_PX = 12;
/** Per-tile width a value can never use: the `p-3` gutters plus the card's borders. */
const MOBILE_TILE_CHROME_PX = 24 + 2;

function useTwoUpMetrics(values: string[]) {
  const gridRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [twoUp, setTwoUp] = useState(true);
  const key = values.join('|');

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const measure = measureRef.current;
    if (!grid || !measure) return;

    const evaluate = () => {
      const gridWidth = grid.getBoundingClientRect().width;
      if (gridWidth === 0) return;
      const available = (gridWidth - MOBILE_GRID_GAP_PX) / 2 - MOBILE_TILE_CHROME_PX;
      const widest = Array.from(measure.children).reduce(
        (max, el) => Math.max(max, el.getBoundingClientRect().width),
        0,
      );
      setTwoUp(widest <= available);
    };

    evaluate();
    const observer = new ResizeObserver(evaluate);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [key]);

  return { gridRef, measureRef, twoUp };
}

// Analytics totals carry no per-currency field; use the platform default (XAF)
// via the shared, currency-aware formatter.
const formatCurrency = (value: number) => formatMoney(value);

export function Analytics() {
  const {
    metrics,
    topProducts,
    customerMetrics,
    bookings,
    dateRange,
    setDateRange,
    fetchAnalytics,
    isLoading,
    notReady,
  } = useAnalyticsStore();

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const metricTiles = useMemo(
    () => [
      {
        title: 'Total Sales',
        value: formatCurrency(metrics.totalSales.value),
        change: metrics.totalSales.change,
        changeType: metrics.totalSales.changeType,
        icon: DollarSign,
      },
      {
        title: 'Total Orders',
        value: metrics.totalOrders.value.toString(),
        change: metrics.totalOrders.change,
        changeType: metrics.totalOrders.changeType,
        icon: ShoppingCart,
      },
      {
        title: 'Net Revenue',
        value: formatCurrency(metrics.netRevenue.value),
        change: metrics.netRevenue.change,
        changeType: metrics.netRevenue.changeType,
        icon: Wallet,
      },
      {
        title: 'Average Order Value',
        value: formatCurrency(metrics.averageOrderValue.value),
        change: metrics.averageOrderValue.change,
        changeType: metrics.averageOrderValue.changeType,
        icon: Users,
      },
    ],
    [metrics],
  );

  const { gridRef, measureRef, twoUp } = useTwoUpMetrics(metricTiles.map((m) => m.value));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your store performance and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
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

      {/* Metrics Grid — 2×2 on mobile unless a value would overflow its tile */}
      <div
        ref={gridRef}
        className={cn(
          'grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4',
          twoUp ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        {metricTiles.map((tile) => (
          <MetricCard key={tile.title} {...tile} />
        ))}
      </div>

      {/* Off-screen measurer for the value line (see useTwoUpMetrics) */}
      <div
        ref={measureRef}
        aria-hidden
        className={cn('pointer-events-none fixed -left-[9999px] top-0 invisible', METRIC_VALUE_CLASS)}
      >
        {metricTiles.map((tile) => (
          <span key={tile.title} className="inline-block">{tile.value}</span>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <LineChart className="w-4 h-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <PieChart className="w-4 h-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" />
            Customers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sales Performance</CardTitle>
                  <CardDescription>Daily sales and order trends</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary" />
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
                <CardTitle>Store Snapshot</CardTitle>
                <CardDescription>Customers &amp; bookings this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Customers</span>
                    <span className="text-2xl font-bold">{customerMetrics?.total ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Repeat customers</span>
                    <span className="text-lg font-semibold">{customerMetrics?.repeat ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Repeat rate</span>
                    <span className="text-lg font-semibold">
                      {customerMetrics?.repeatRate ?? 0}%
                    </span>
                  </div>
                  <div className="border-t pt-4 flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4" /> Bookings
                    </span>
                    <span className="text-lg font-semibold">{bookings?.count ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Booking revenue</span>
                    <span className="text-lg font-semibold">
                      {formatCurrency(bookings?.revenue ?? 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best performing products this period</CardDescription>
            </CardHeader>
            <CardContent>
              <TopProductsList products={topProducts} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Analytics</CardTitle>
              <CardDescription>Daily sales breakdown for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Ranked by revenue, with units sold</CardDescription>
            </CardHeader>
            <CardContent>
              <TopProductsList products={topProducts} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Customers</CardTitle>
                <CardDescription>Unique buyers with paid orders</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{customerMetrics?.total ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Repeat Customers</CardTitle>
                <CardDescription>Buyers with 2+ completed orders</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{customerMetrics?.repeat ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Repeat Rate</CardTitle>
                <CardDescription>Share of repeat customers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{customerMetrics?.repeatRate ?? 0}%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
