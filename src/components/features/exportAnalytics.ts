import { exportFileName, isoDay, spreadsheetBlob, type SheetCell } from '@/lib/spreadsheet';
import { saveBlob, type SaveOutcome } from '@/platform/filesystem';
import type { useTranslation, Formatters } from '@/i18n';
import type { AnalyticsState } from '@/store/contexts';

type Translate = ReturnType<typeof useTranslation>['t'];

type AnalyticsSnapshot = Pick<
  AnalyticsState,
  'metrics' | 'salesData' | 'topProducts' | 'customerMetrics' | 'summary' | 'dateRange'
>;

/**
 * The analytics page as one Excel sheet: the period, the four headline figures,
 * sales day by day, the top products, then customers and bookings — each block
 * under its own bold title row with a blank row between, so it reads top to
 * bottom the way the page does. Built from what the page has already loaded;
 * nothing is fetched again.
 */
export async function exportAnalytics(
  data: AnalyticsSnapshot,
  t: Translate,
  fmt: Formatters,
  storeName: string | null | undefined,
): Promise<SaveOutcome> {
  const { metrics, salesData, topProducts, customerMetrics, summary, dateRange } = data;
  const from = isoDay(dateRange.from);
  const to = isoDay(dateRange.to);

  const rows: SheetCell[][] = [];
  const headerRows: number[] = [];
  const title = (row: SheetCell[]) => {
    headerRows.push(rows.length);
    rows.push(row);
  };

  title([t('analytics.title'), `${from} → ${to}`]);
  rows.push([]);
  title([t('analytics.exportFile.figure'), t('analytics.exportFile.value'), t('analytics.exportFile.change')]);
  rows.push(
    [t('overview.metrics.totalSales'), metrics.totalSales.value, `${metrics.totalSales.change}%`],
    [t('overview.metrics.totalOrders'), metrics.totalOrders.value, `${metrics.totalOrders.change}%`],
    [t('overview.metrics.netRevenue'), metrics.netRevenue.value, `${metrics.netRevenue.change}%`],
    [t('overview.metrics.averageOrderValue'), metrics.averageOrderValue.value, `${metrics.averageOrderValue.change}%`],
    [],
  );
  title([t('analytics.exportFile.date'), t('analytics.charts.legendSales'), t('analytics.charts.legendOrders')]);
  rows.push(...salesData.map((point) => [isoDay(point.date), point.sales, point.orders]), []);
  title([
    t('analytics.charts.topProductsTitle'),
    t('analytics.exportFile.sku'),
    t('analytics.exportFile.quantity'),
    t('analytics.exportFile.orders'),
    t('analytics.exportFile.revenue'),
  ]);
  rows.push(
    ...topProducts.map((p) => [p.productTitle, p.sku, p.quantity, p.orderCount, p.revenue]),
    [],
    [t('analytics.snapshot.customers'), customerMetrics?.total ?? 0],
    [t('analytics.snapshot.repeatCustomers'), customerMetrics?.repeat ?? 0],
    [t('analytics.snapshot.repeatRate'), fmt.percent(customerMetrics?.repeatRate ?? 0, Number.isInteger(customerMetrics?.repeatRate ?? 0) ? 0 : 1)],
    [t('analytics.snapshot.bookings'), summary?.bookings?.count ?? 0],
    [t('analytics.snapshot.bookingRevenue'), summary?.bookings?.grossRevenue ?? 0],
  );

  return saveBlob({
    blob: await spreadsheetBlob({ name: t('analytics.title'), rows, headerRows }),
    fileName: exportFileName(storeName, t('analytics.exportFile.fileName'), from, to),
  });
}
