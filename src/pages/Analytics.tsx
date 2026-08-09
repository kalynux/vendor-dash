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
import { useTranslation, useFormatters } from '@/i18n';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ElementType;
}

function MetricCard({ title, value, change, changeType, icon: Icon }: MetricCardProps) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in h-full">
      <Card className="hover:shadow-lg transition-shadow h-full">
        {/* Mobile keeps its `p-3` gutters — useTwoUpMetrics measures against them. */}
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1 sm:space-y-1.5">
              {/* On phones the icon rides inline with the label — the badge on the
                  right needs width a half-width tile can't spare. */}
              <p className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground leading-tight">
                <Icon className="w-3.5 h-3.5 mt-px flex-shrink-0 sm:hidden" />
                {title}
              </p>
              <p className={cn(METRIC_VALUE_CLASS, 'sm:text-xl sm:leading-tight')}>{value}</p>
              <div className="flex items-center gap-1">
                {changeType === 'increase' ? (
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                ) : changeType === 'decrease' ? (
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
                ) : null}
                <span
                  className={cn(
                    'text-xs font-medium',
                    changeType === 'increase' && 'text-green-500',
                    changeType === 'decrease' && 'text-red-500',
                    changeType === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  {t('overview.metrics.vsLastPeriod')}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
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

export function Analytics() {
  const { t } = useTranslation();
  const fmt = useFormatters();

  // Analytics totals carry no per-currency field; use the platform default (XAF)
  // via the shared, locale-aware formatter.
  const formatCurrency = (value: number) => fmt.currency(value);

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
        title: t('overview.metrics.totalSales'),
        value: fmt.currency(metrics.totalSales.value),
        change: metrics.totalSales.change,
        changeType: metrics.totalSales.changeType,
        icon: DollarSign,
      },
      {
        title: t('overview.metrics.totalOrders'),
        value: fmt.number(metrics.totalOrders.value),
        change: metrics.totalOrders.change,
        changeType: metrics.totalOrders.changeType,
        icon: ShoppingCart,
      },
      {
        title: t('overview.metrics.netRevenue'),
        value: fmt.currency(metrics.netRevenue.value),
        change: metrics.netRevenue.change,
        changeType: metrics.netRevenue.changeType,
        icon: Wallet,
      },
      {
        title: t('overview.metrics.averageOrderValue'),
        value: fmt.currency(metrics.averageOrderValue.value),
        change: metrics.averageOrderValue.change,
        changeType: metrics.averageOrderValue.changeType,
        icon: Users,
      },
    ],
    // `t` and `fmt` are memoized per locale, so this recomputes on a language switch.
    [metrics, t, fmt],
  );

  const { gridRef, measureRef, twoUp } = useTwoUpMetrics(metricTiles.map((m) => m.value));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">{t('analytics.headerSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            {t('analytics.export')}
          </Button>
        </div>
      </div>

      {/* Data-not-ready notice (backend 503 AGGREGATION_NOT_READY) */}
      {notReady && !isLoading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4 text-amber-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{t('analytics.notReady')}</p>
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
            {t('analytics.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <LineChart className="w-4 h-4" />
            {t('analytics.tabs.sales')}
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <PieChart className="w-4 h-4" />
            {t('analytics.tabs.products')}
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" />
            {t('analytics.tabs.customers')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('analytics.charts.salesTitle')}</CardTitle>
                  <CardDescription>{t('analytics.charts.salesDescription')}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    {t('analytics.charts.legendSales')}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    {t('analytics.charts.legendOrders')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <SalesChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.charts.snapshotTitle')}</CardTitle>
                <CardDescription>{t('analytics.charts.snapshotDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('analytics.snapshot.customers')}</span>
                    <span className="text-2xl font-bold">{customerMetrics?.total ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('analytics.snapshot.repeatCustomers')}</span>
                    <span className="text-lg font-semibold">{customerMetrics?.repeat ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('analytics.snapshot.repeatRate')}</span>
                    <span className="text-lg font-semibold">
                      {customerMetrics?.repeatRate ?? 0}%
                    </span>
                  </div>
                  <div className="border-t pt-4 flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4" /> {t('analytics.snapshot.bookings')}
                    </span>
                    <span className="text-lg font-semibold">{bookings?.count ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('analytics.snapshot.bookingRevenue')}</span>
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
              <CardTitle>{t('analytics.charts.topProductsTitle')}</CardTitle>
              <CardDescription>{t('analytics.charts.topProductsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TopProductsList products={topProducts} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.charts.salesAnalyticsTitle')}</CardTitle>
              <CardDescription>{t('analytics.charts.salesAnalyticsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.products.title')}</CardTitle>
              <CardDescription>{t('analytics.products.description')}</CardDescription>
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
                <CardTitle className="text-sm">{t('analytics.customers.totalTitle')}</CardTitle>
                <CardDescription>{t('analytics.customers.totalDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{customerMetrics?.total ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('analytics.customers.repeatTitle')}</CardTitle>
                <CardDescription>{t('analytics.customers.repeatDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{customerMetrics?.repeat ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('analytics.customers.repeatRateTitle')}</CardTitle>
                <CardDescription>{t('analytics.customers.repeatRateDescription')}</CardDescription>
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
