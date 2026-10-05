import { csvBlob, csvDate, type CsvCell } from '@/lib/csv';
import { saveBlob, type SaveOutcome } from '@/platform/filesystem';
import type { useTranslation, Formatters } from '@/i18n';
import type { AnalyticsState } from '@/store/contexts';

type Translate = ReturnType<typeof useTranslation>['t'];

type AnalyticsSnapshot = Pick<
  AnalyticsState,
  'metrics' | 'salesData' | 'topProducts' | 'customerMetrics' | 'summary' | 'dateRange'
>;

/**
 * The analytics page as one spreadsheet: the period, the four headline figures,
 * sales day by day, the top products, then customers and bookings — each block
 * under its own heading row with a blank row between, so it reads top to bottom
 * the way the page does. Built from what the page has already loaded; nothing
 * is fetched again.
 */
export async function exportAnalytics(
  data: AnalyticsSnapshot,
  t: Translate,
  fmt: Formatters,
): Promise<SaveOutcome> {
  const { metrics, salesData, topProducts, customerMetrics, summary, dateRange } = data;
  const from = csvDate(dateRange.from);
  const to = csvDate(dateRange.to);

  const rows: CsvCell[][] = [
    [t('analytics.title'), `${from} → ${to}`],
    [],
    [t('analytics.exportFile.figure'), t('analytics.exportFile.value'), t('analytics.exportFile.change')],
    [t('overview.metrics.totalSales'), metrics.totalSales.value, `${metrics.totalSales.change}%`],
    [t('overview.metrics.totalOrders'), metrics.totalOrders.value, `${metrics.totalOrders.change}%`],
    [t('overview.metrics.netRevenue'), metrics.netRevenue.value, `${metrics.netRevenue.change}%`],
    [t('overview.metrics.averageOrderValue'), metrics.averageOrderValue.value, `${metrics.averageOrderValue.change}%`],
    [],
    [t('analytics.exportFile.date'), t('analytics.charts.legendSales'), t('analytics.charts.legendOrders')],
    ...salesData.map((point) => [csvDate(point.date), point.sales, point.orders]),
    [],
    [
      t('analytics.charts.topProductsTitle'),
      t('analytics.exportFile.sku'),
      t('analytics.exportFile.quantity'),
      t('analytics.exportFile.orders'),
      t('analytics.exportFile.revenue'),
    ],
    ...topProducts.map((p) => [p.productTitle, p.sku, p.quantity, p.orderCount, p.revenue]),
    [],
    [t('analytics.snapshot.customers'), customerMetrics?.total ?? 0],
    [t('analytics.snapshot.repeatCustomers'), customerMetrics?.repeat ?? 0],
    [t('analytics.snapshot.repeatRate'), fmt.percent(customerMetrics?.repeatRate ?? 0, Number.isInteger(customerMetrics?.repeatRate ?? 0) ? 0 : 1)],
    [t('analytics.snapshot.bookings'), summary?.bookings?.count ?? 0],
    [t('analytics.snapshot.bookingRevenue'), summary?.bookings?.grossRevenue ?? 0],
  ];

  return saveBlob({
    blob: csvBlob(rows, fmt.locale),
    fileName: `${t('analytics.exportFile.fileName')}-${from}-${to}.csv`,
  });
}
