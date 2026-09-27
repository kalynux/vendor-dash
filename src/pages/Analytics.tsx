import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PieChart,
  LineChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { useAnalyticsStore } from '@/store';
import { SalesChart } from '@/components/features/SalesChart';
import { TopProductsList } from '@/components/features/TopProductsList';
import { EarningsSummary } from '@/components/features/EarningsSummary';
import { DateRangePicker } from '@/components/features/DateRangePicker';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { RefreshButton } from '@/components/common/RefreshButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters, type TranslationKey } from '@/i18n';

/** The chart's key, as plain text — two coloured dots, no pill badges. */
function ChartLegend() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" />
        {t('analytics.charts.legendSales')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-blue-400" />
        {t('analytics.charts.legendOrders')}
      </span>
    </div>
  );
}

/** A label on the left, its figure on the right. */
function StatRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

interface MetricTileProps {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  /** Two tiles per row on a phone: the left one pads right, the right one left. */
  twoUp: boolean;
}

/**
 * One headline figure. On a phone it is a flat cell of the hairline grid below
 * — a card per figure inside the page's own gutter is what pushed the amounts
 * into a single column. From `md` up there is room, and the card comes back.
 */
function MetricTile({ title, value, change, changeType, twoUp }: MetricTileProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'bg-background py-3',
        twoUp && 'max-md:odd:pr-3 max-md:even:pl-3',
        'md:rounded-xl md:border md:bg-card md:p-4 md:shadow-sm',
      )}
    >
      <p className="text-xs font-medium leading-tight text-muted-foreground">{title}</p>
      <p className={cn(METRIC_VALUE_CLASS, 'mt-1 tabular-nums md:text-xl md:leading-tight')}>{value}</p>
      <p
        className={cn(
          'mt-1 flex items-center gap-1 text-xs font-medium',
          changeType === 'increase' && 'text-green-600',
          changeType === 'decrease' && 'text-red-600',
          changeType === 'neutral' && 'text-muted-foreground',
        )}
      >
        {changeType === 'increase' ? (
          <TrendingUp className="size-3.5 shrink-0" />
        ) : changeType === 'decrease' ? (
          <TrendingDown className="size-3.5 shrink-0" />
        ) : null}
        {change > 0 ? '+' : ''}{change}%
        <span className="font-normal text-muted-foreground max-md:hidden">
          {t('overview.metrics.vsLastPeriod')}
        </span>
      </p>
    </div>
  );
}

// ─── Mobile 2-up metric grid ──────────────────────────────────────────────────
// The four totals sit 2×2 on phones, but an XAF amount like "1 250 000 FCFA"
// can still be too wide for half the screen. Rather than truncate or wrap it, we
// measure each formatted value off-screen and fall back to a single column when
// any of them is wider than the room a 2-up tile leaves for text. Measuring the
// *natural* text width (instead of testing the rendered tile for overflow) keeps
// the decision stable — it doesn't change once we've switched to one column, so
// the layout can't oscillate.

/** Typography of the value line at the mobile size — kept in sync with the measurer. */
const METRIC_VALUE_CLASS = 'text-lg font-bold whitespace-nowrap';
/** The 1px hairline between the two mobile columns (`gap-px`). */
const MOBILE_GRID_GAP_PX = 1;
/** Per-tile width a value can never use: the 12px inner padding beside the hairline. */
const MOBILE_TILE_CHROME_PX = 12;

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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const VALID_TABS = ['overview', 'sales', 'products', 'customers'] as const;

/** The same four, as routes — what a sideways swipe walks. Order matters. */
const TAB_RING = VALID_TABS.map((tab) => `/dashboard/analytics/${tab}`);
type AnalyticsTab = (typeof VALID_TABS)[number];
const DEFAULT_TAB: AnalyticsTab = 'overview';

const TAB_ICONS: Record<AnalyticsTab, typeof BarChart3> = {
  overview: BarChart3,
  sales: LineChart,
  products: PieChart,
  customers: Users,
};

const isValidTab = (v: string | null | undefined): v is AnalyticsTab =>
  !!v && (VALID_TABS as readonly string[]).includes(v);

export function Analytics() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const [searchParams] = useSearchParams();

  const tab: AnalyticsTab | null = isValidTab(tabParam) ? tabParam : null;

  // Before the bare-path redirect below — a hook cannot sit behind an early
  // return. The mobile strip scrolls horizontally, and `useSwipeNavigate` leaves
  // gestures that start inside a horizontal scroller alone, so dragging the
  // strip still just scrolls the strip.
  useRouteSwipe(TAB_RING);

  const goToTab = useCallback(
    // Pushes, so back steps through the tabs — and so a tap leaves exactly the
    // history a swipe does.
    (next: AnalyticsTab) => navigate(`/dashboard/analytics/${next}`),
    [navigate],
  );

  // Analytics totals carry no per-currency field; use the platform default (XAF)
  // via the shared, locale-aware formatter.
  const formatCurrency = (value: number) => fmt.currency(value);

  const {
    metrics,
    topProducts,
    customerMetrics,
    summary,
    dateRange,
    setDateRange,
    fetchAnalytics,
    isLoading,
  } = useAnalyticsStore();
  const bookings = summary?.bookings;

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
      },
      {
        title: t('overview.metrics.totalOrders'),
        value: fmt.number(metrics.totalOrders.value),
        change: metrics.totalOrders.change,
        changeType: metrics.totalOrders.changeType,
      },
      {
        title: t('overview.metrics.netRevenue'),
        value: fmt.currency(metrics.netRevenue.value),
        change: metrics.netRevenue.change,
        changeType: metrics.netRevenue.changeType,
      },
      {
        title: t('overview.metrics.averageOrderValue'),
        value: fmt.currency(metrics.averageOrderValue.value),
        change: metrics.averageOrderValue.change,
        changeType: metrics.averageOrderValue.changeType,
      },
    ],
    // `t` and `fmt` are memoized per locale, so this recomputes on a language switch.
    [metrics, t, fmt],
  );

  const { gridRef, measureRef, twoUp } = useTwoUpMetrics(metricTiles.map((m) => m.value));

  // Bare `/dashboard/analytics` (or a bogus segment) lands on the default tab.
  // Redirecting from inside the component rather than with a `<Route element=
  // {<Navigate/>}>` is what carries the query string over — same as Inventory.
  if (!tab) {
    const query = searchParams.toString();
    return <Navigate to={`/dashboard/analytics/${DEFAULT_TAB}${query ? `?${query}` : ''}`} replace />;
  }

  /**
   * Mobile sub-navigation. Four labels across 360px left ~90px a cell, which
   * wrapped "Customers" (and clipped "Vue d'ensemble" outright) — so this
   * scrolls horizontally instead of squeezing, exactly like Inventory's strip.
   */
  const mobileTabStrip = (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {VALID_TABS.map((value) => {
          const Icon = TAB_ICONS[value];
          const active = value === tab;
          return (
            <button
              key={value}
              type="button"
              onClick={() => goToTab(value)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'tap-target flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`analytics.tabs.${value}` as TranslationKey)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn('animate-fade-in', isMobile ? '-mx-6 -mt-6' : 'space-y-6')}>
      {/* Header. The mobile one is pinned and carries the notifications bell —
          this page had no header of its own on a phone, so the desktop row was
          stacking into three lines above the first chart. The date range moves
          into the reveal-on-scroll-up row, where every other list page puts its
          controls. */}
      {isMobile ? (
        <MobilePageHeader
          title={t('analytics.title')}
          description={t('analytics.headerSubtitle')}
          onRefresh={fetchAnalytics}
          actions={[
            {
              id: 'export',
              icon: Download,
              label: t('analytics.export'),
              onClick: () => {/* export */ },
            },
          ]}
          subheader={
            <div className="space-y-2">
              {mobileTabStrip}
              <div className="flex justify-end">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshButton onRefresh={fetchAnalytics} />
            <div>
              <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
              <p className="text-muted-foreground">{t('analytics.headerSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              {t('analytics.export')}
            </Button>
          </div>
        </div>
      )}

      {/* Full-bleed on mobile, so the body sets its own 16px gutter. */}
      <div className={cn(isMobile ? 'px-4' : 'space-y-6')}>

      {/* Metrics — on a phone a flat 2×2 grid whose 1px gaps show the border
          colour behind the cells as hairlines; cards again from `md` up. */}
      <div
        ref={gridRef}
        className={cn(
          'grid gap-px bg-border md:grid-cols-2 md:gap-4 md:bg-transparent lg:grid-cols-4',
          twoUp ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        {metricTiles.map((tile) => (
          <MetricTile key={tile.title} {...tile} twoUp={twoUp} />
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

      {/* Main Content Tabs — the URL owns which one is open, so a link, the back
          button and a sideways swipe all reach the same four panes. */}
      <Tabs value={tab} onValueChange={(v) => goToTab(v as AnalyticsTab)} className="w-full">
        {/* Desktop only: on a phone the pinned header's pill strip is the tab
            affordance, and a second row of them would just be the same four
            labels twice. */}
        {!isMobile && (
          <TabsList className="h-11 rounded-xl">
            {VALID_TABS.map((value) => {
              const Icon = TAB_ICONS[value];
              return (
                <TabsTrigger key={value} value={value} className="gap-2">
                  <Icon className="w-4 h-4" />
                  {t(`analytics.tabs.${value}` as TranslationKey)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        )}

        {/* Every pane is a stack of sections: flat and split by hairlines on a
            phone (the metrics above end on the first line), cards from `md` up.
            `SettingsSection` owns that switch, so this page and the settings
            screens stay one visual language. */}
        <TabsContent value="overview" className="mt-0 md:mt-6">
          {/* Phone order is what matters most first: the trend, the money, what
              sold, then the customers. On wide screens `lg:order-*` puts the
              snapshot beside the chart. */}
          <div className="max-md:divide-y max-md:divide-border max-md:border-t md:grid md:gap-6 lg:grid-cols-6">
            <SettingsSection
              className="lg:col-span-4"
              title={t('analytics.charts.salesTitle')}
              info={t('analytics.charts.salesDescription')}
              action={<ChartLegend />}
            >
              <SalesChart />
            </SettingsSection>

            <SettingsSection
              className="lg:order-3 lg:col-span-3"
              title={t('analytics.earnings.title')}
              info={t('analytics.earnings.description')}
            >
              <EarningsSummary />
            </SettingsSection>

            <SettingsSection
              className="lg:order-4 lg:col-span-3"
              title={t('analytics.charts.topProductsTitle')}
              info={t('analytics.charts.topProductsDescription')}
            >
              <TopProductsList products={topProducts} isLoading={isLoading} flush />
            </SettingsSection>

            <SettingsSection
              className="lg:order-2 lg:col-span-2"
              title={t('analytics.charts.snapshotTitle')}
              info={t('analytics.charts.snapshotDescription')}
            >
              <dl className="space-y-3 text-sm">
                <StatRow label={t('analytics.snapshot.customers')} value={fmt.number(customerMetrics?.total ?? 0)} />
                <StatRow label={t('analytics.snapshot.repeatCustomers')} value={fmt.number(customerMetrics?.repeat ?? 0)} />
                <StatRow label={t('analytics.snapshot.repeatRate')} value={`${customerMetrics?.repeatRate ?? 0}%`} />
                <StatRow
                  className="border-t pt-3"
                  label={t('analytics.snapshot.bookings')}
                  value={fmt.number(bookings?.count ?? 0)}
                />
                <StatRow
                  label={t('analytics.snapshot.bookingRevenue')}
                  value={formatCurrency(bookings?.grossRevenue ?? 0)}
                />
              </dl>
            </SettingsSection>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="mt-0 md:mt-6">
          <div className="max-md:border-t">
            <SettingsSection
              title={t('analytics.charts.salesAnalyticsTitle')}
              info={t('analytics.charts.salesAnalyticsDescription')}
              action={<ChartLegend />}
            >
              <SalesChart />
            </SettingsSection>
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-0 md:mt-6">
          <div className="max-md:border-t">
            <SettingsSection
              title={t('analytics.products.title')}
              info={t('analytics.products.description')}
            >
              <TopProductsList products={topProducts} isLoading={isLoading} flush />
            </SettingsSection>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="mt-0 md:mt-6">
          {/* A phone reads these as a list — label and meaning on the left, the
              number on the right; three cards side by side from `md` up. */}
          <div className="max-md:divide-y max-md:divide-border max-md:border-t md:grid md:grid-cols-3 md:gap-6">
            {[
              {
                key: 'total',
                title: t('analytics.customers.totalTitle'),
                description: t('analytics.customers.totalDescription'),
                value: fmt.number(customerMetrics?.total ?? 0),
              },
              {
                key: 'repeat',
                title: t('analytics.customers.repeatTitle'),
                description: t('analytics.customers.repeatDescription'),
                value: fmt.number(customerMetrics?.repeat ?? 0),
              },
              {
                key: 'rate',
                title: t('analytics.customers.repeatRateTitle'),
                description: t('analytics.customers.repeatRateDescription'),
                value: `${customerMetrics?.repeatRate ?? 0}%`,
              },
            ].map((stat) => (
              <div
                key={stat.key}
                className="flex items-center justify-between gap-4 py-4 md:block md:rounded-xl md:border md:bg-card md:p-6 md:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{stat.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.description}</p>
                </div>
                <p className="shrink-0 text-2xl font-bold tabular-nums md:mt-4 md:text-3xl">{stat.value}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
