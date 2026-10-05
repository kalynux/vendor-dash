import { fetchOrders } from '@/services/orders.service';
import { orderFiltersToQuery, type OrderFilters } from '@/lib/orderFilters';
import { ORDER_STATUS_KEYS, PAYMENT_METHOD_FILTER_OPTIONS, PAYMENT_STATUS_FILTER_OPTIONS } from '@/lib/orderStatus';
import { csvBlob, csvDate, csvDateTime, type CsvCell } from '@/lib/csv';
import { saveBlob, type SaveOutcome } from '@/platform/filesystem';
import type { Locale } from '@/i18n/config';
import type { TranslationKey, useTranslation } from '@/i18n';
import type { Order } from '@/types';

/** The list endpoint's page ceiling. */
const PAGE_SIZE = 100;
/**
 * 5 000 orders. Far past anything a vendor scrolls through; a stop so a
 * runaway filter cannot hold the button in "Exporting…" for minutes.
 */
const MAX_PAGES = 50;

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Every order the list is currently filtered to — not just the page on screen —
 * as a spreadsheet. There is no server-side export, so the pages are walked
 * here and the file is built in the browser.
 *
 * Returns how many orders went into the file alongside the save outcome, so the
 * caller can say "12 orders exported" or "nothing to export".
 */
export async function exportOrders(
  filters: OrderFilters,
  t: Translate,
  locale: Locale,
): Promise<{ count: number; outcome: SaveOutcome | 'empty' }> {
  const orders: Order[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, meta } = await fetchOrders(orderFiltersToQuery(filters, page, PAGE_SIZE));
    orders.push(...data);
    if (page >= meta.pages || data.length === 0) break;
  }
  if (orders.length === 0) return { count: 0, outcome: 'empty' };

  const label = (options: { value: string; labelKey: TranslationKey }[], value: string) => {
    const option = options.find((o) => o.value === value);
    return option ? t(option.labelKey) : value;
  };

  const rows: CsvCell[][] = [
    [
      t('orders.export.columns.orderNumber'),
      t('orders.export.columns.date'),
      t('orders.export.columns.customer'),
      t('orders.export.columns.email'),
      t('orders.export.columns.type'),
      t('orders.export.columns.status'),
      t('orders.export.columns.paymentStatus'),
      t('orders.export.columns.paymentMethod'),
      t('orders.export.columns.items'),
      t('orders.export.columns.subtotal'),
      t('orders.export.columns.shipping'),
      t('orders.export.columns.tax'),
      t('orders.export.columns.total'),
      t('orders.export.columns.currency'),
    ],
    ...orders.map((o) => [
      o.orderNumber,
      csvDateTime(o.createdAt),
      o.customer.name,
      o.customer.email,
      t(o.orderType === 'digital' ? 'orders.orderType.digital' : 'orders.orderType.physical'),
      t(ORDER_STATUS_KEYS[o.status]),
      label(PAYMENT_STATUS_FILTER_OPTIONS, o.paymentStatus),
      o.paymentMethod ? label(PAYMENT_METHOD_FILTER_OPTIONS, o.paymentMethod) : '',
      o.items.length,
      o.subtotal,
      o.shipping,
      o.tax,
      o.total,
      o.currency,
    ]),
  ];

  const outcome = await saveBlob({
    blob: csvBlob(rows, locale),
    fileName: `${t('orders.export.fileName')}-${csvDate(new Date())}.csv`,
  });
  return { count: orders.length, outcome };
}
