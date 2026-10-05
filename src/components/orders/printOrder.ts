import type { Formatters, useTranslation } from '@/i18n';
import type { Order } from '@/types';
import { formatPhoneInternational } from '@/lib/phone';

type Translate = ReturnType<typeof useTranslation>['t'];

interface PrintOrderInput {
  order: Order;
  /** The delivery address as display lines (already de-duplicated by the caller). */
  addressLines: string[];
  storeName: string;
  t: Translate;
  fmt: Formatters;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Print one order as a plain A4 sheet — something to slip into the parcel or
 * file away.
 *
 * `window.print()` on the page itself would print the dashboard: the sidebar,
 * the dimmed list behind the dialog, and only the visible part of a scrolling
 * dialog. So the sheet is written into a hidden iframe with its own small
 * stylesheet and printed from there.
 *
 * ⚠ Desktop browsers only. The Android WebView has no print dialog, which is
 * why this button lives in the desktop order dialog and not the phone sheet.
 */
export function printOrder({ order, addressLines, storeName, t, fmt }: PrintOrderInput): void {
  const money = (value: number) => escapeHtml(fmt.currency(value, order.currency));
  const customerLines = [
    order.customer.name,
    order.customer.email,
    order.customer.phone ? formatPhoneInternational(order.customer.phone) : null,
  ].filter(Boolean);

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}${item.sku ? `<div class="muted">${escapeHtml(item.sku)}</div>` : ''}</td>
          <td class="num">${escapeHtml(fmt.number(item.quantity))}</td>
          <td class="num">${money(item.price)}</td>
          <td class="num">${money(item.total)}</td>
        </tr>`,
    )
    .join('');

  const summaryRows = [
    [t('orders.detail.summary.subtotal'), money(order.subtotal)],
    order.shipping > 0 ? [t('orders.detail.summary.shipping'), money(order.shipping)] : null,
    order.tax > 0 ? [t('orders.detail.summary.tax'), money(order.tax)] : null,
    order.discount > 0 ? [t('orders.detail.summary.discount'), `−${money(order.discount)}`] : null,
  ]
    .filter((row): row is string[] => row !== null)
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="num">${value}</td></tr>`)
    .join('');

  const html = `<!doctype html>
<html lang="${escapeHtml(fmt.locale)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(order.orderNumber)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #666; font-size: 11px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ddd; padding-bottom: 12px; margin-bottom: 16px; }
  .cols { display: flex; gap: 32px; margin-bottom: 20px; }
  .cols > div { flex: 1; }
  .label { font-size: 11px; color: #666; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #666; font-weight: 600; border-bottom: 1px solid #ddd; padding: 6px 0; }
  td { padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  th.num, td.num { text-align: right; padding-left: 12px; white-space: nowrap; }
  .totals { width: 50%; margin-left: auto; margin-top: 12px; }
  .totals td { border: 0; padding: 3px 0; }
  .totals .grand td { border-top: 1px solid #ddd; padding-top: 8px; font-weight: 700; font-size: 14px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>${escapeHtml(order.orderNumber)}</h1>
      <div class="muted">${escapeHtml(t('orders.detail.placedOn', { date: fmt.dateTime(order.createdAt) }))}</div>
    </div>
    <div style="text-align:right">
      <strong>${escapeHtml(storeName)}</strong>
      <div class="muted">${escapeHtml(
        order.paymentMethod === 'cash_on_delivery'
          ? t('orders.paymentMethod.cashOnDelivery')
          : t('orders.paymentMethod.online'),
      )}</div>
    </div>
  </div>

  <div class="cols">
    <div>
      <div class="label">${escapeHtml(t('orders.detail.customer.title'))}</div>
      ${customerLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
    </div>
    ${
      addressLines.length > 0
        ? `<div>
      <div class="label">${escapeHtml(t('orders.detail.shipping.addressTitle'))}</div>
      ${addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
    </div>`
        : ''
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>${escapeHtml(t('orders.print.product'))}</th>
        <th class="num">${escapeHtml(t('orders.print.quantity'))}</th>
        <th class="num">${escapeHtml(t('orders.print.unitPrice'))}</th>
        <th class="num">${escapeHtml(t('orders.print.amount'))}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    ${summaryRows}
    <tr class="grand"><td>${escapeHtml(t('orders.detail.summary.total'))}</td><td class="num">${money(order.total)}</td></tr>
  </table>
</body>
</html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  // Removed only after the print dialog closes: some browsers read the frame
  // after `print()` returns, and removing it early prints a blank page.
  win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0));
  // Give the frame a tick to lay out before opening the dialog.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 50);
}

