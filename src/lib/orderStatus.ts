import type { ElementType } from 'react';
import { PackageSearch, XCircle } from 'lucide-react';
import { isOrderFrozen } from '@/services/orders.service';
import type { Formatters, TranslateParams, TranslationKey } from '@/i18n';
import type { Order, OrderStatus, PaymentMethod, PaymentStatus, VendorSettableStatus } from '@/types';

type Translate = (key: TranslationKey, params?: TranslateParams) => string;

/**
 * Statuses a vendor can move an order to next, from its current status.
 * `shipped`/`partially_shipped`/`partially_delivered`/`delivered`/`fulfilled` are
 * system-computed from shipment activity and are never vendor-settable — the same
 * rule applies to physical and digital orders alike (PATCH /orders/:id/status only
 * ever accepts pending/processing/cancelled).
 */
export function getNextStatuses(status: OrderStatus): VendorSettableStatus[] {
  switch (status) {
    case 'pending': return ['processing', 'cancelled'];
    case 'processing': return ['cancelled'];
    default: return [];
  }
}

/**
 * Labels live as translation keys rather than strings: this module has no React
 * context to read a locale from, so each call site resolves the key with its own
 * `t()`. Same for the filter-option lists further down.
 */
export const STATUS_ACTION_KEYS: Record<VendorSettableStatus, TranslationKey> = {
  pending: 'orders.statusActions.pending',
  processing: 'orders.statusActions.processing',
  cancelled: 'orders.statusActions.cancelled',
};

/** Every fulfilment status, for read-only display (badges, "no further actions"). */
export const ORDER_STATUS_KEYS: Record<OrderStatus, TranslationKey> = {
  pending: 'orders.status.pending',
  processing: 'orders.status.processing',
  partially_shipped: 'orders.status.partiallyShipped',
  shipped: 'orders.status.shipped',
  partially_delivered: 'orders.status.partiallyDelivered',
  delivered: 'orders.status.delivered',
  fulfilled: 'orders.status.fulfilled',
  cancelled: 'orders.status.cancelled',
  returned: 'orders.status.returned',
};

export const STATUS_ICONS: Record<VendorSettableStatus, ElementType> = {
  pending: PackageSearch,
  processing: PackageSearch,
  cancelled: XCircle,
};

/**
 * A partial-payment order whose online part is still unpaid (FRONTEND-CHANGELOG-partial-payment,
 * 2026-11-01). It reads `AWAITING_PAYMENT` exactly like a plain COD order, which CAN be prepared
 * and dispatched, so only `partialPayment` tells the two apart — never go by the status alone.
 */
export function isOnlinePartDue(order: Order): boolean {
  return !!order.partialPayment && !order.partialPayment.paidAt;
}

/** Still worth telling the vendor to wait: `isOnlinePartDue`, and the order is still alive. */
export function isWaitingForOnlinePart(order: Order): boolean {
  return isOnlinePartDue(order) && order.paymentStatus === 'AWAITING_PAYMENT' && order.status !== 'cancelled';
}

/** A partial order whose cash will never be collected, so "collected at delivery" would be false. */
export function isPartialPaymentClosed(order: Order): boolean {
  return (
    !!order.partialPayment &&
    (order.status === 'cancelled' ||
      order.status === 'returned' ||
      order.paymentStatus === 'failed' ||
      order.paymentStatus === 'refunded')
  );
}

/** The line shown with the payment status of a partial order; `null` on every other order. */
export function partialPaymentSentence(order: Order, t: Translate, fmt: Formatters): string | null {
  const part = order.partialPayment;
  if (!part) return null;
  if (isOnlinePartDue(order)) return isWaitingForOnlinePart(order) ? t('orders.partialPayment.dueShort') : null;
  const paid = fmt.currency(part.amountPaidOnline, order.currency);
  if (isPartialPaymentClosed(order)) return t('orders.partialPayment.paidOnlineOnly', { paid });
  return t('orders.partialPayment.split', { paid, balance: fmt.currency(part.balanceDue, order.currency) });
}

/**
 * The warning for the cancel dialogs: `null` when no money was paid in. Cancelling a partial order
 * after its online part was paid works like cancelling a paid order, the customer is refunded in
 * full and the vendor pays the fees.
 */
export function paidCancelNoticeKey(order: Order): TranslationKey | null {
  if (order.paymentStatus === 'paid') return 'orders.detail.cancelDialog.paidNotice';
  if (order.paymentStatus === 'partially_paid' && order.partialPayment?.paidAt) {
    return 'orders.detail.cancelDialog.partialPaidNotice';
  }
  return null;
}

/**
 * `getNextStatuses`, additionally accounting for a dispute-frozen order (no moves allowed) and for
 * a partial order still waiting for its online part: the server would accept `processing` there,
 * but the vendor is being told not to prepare it. Cancelling stays available.
 */
export function getEffectiveNextStatuses(order: Order): VendorSettableStatus[] {
  if (isOrderFrozen(order)) return [];
  const next = getNextStatuses(order.status);
  return isOnlinePartDue(order) ? next.filter((s) => s !== 'processing') : next;
}

const DISPATCH_TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'delivered', 'returned', 'fulfilled'];

/**
 * Cash-on-delivery orders invert the payment/fulfilment sequence — they fulfil (and can be
 * dispatched to a delivery agency) before payment, getting paid per shipment as the agent
 * collects cash. Online orders keep the old rule: must be `paid` before dispatch.
 */
const COD_DISPATCHABLE_PAYMENT_STATUSES: PaymentStatus[] = ['AWAITING_PAYMENT', 'partially_paid', 'paid'];

/**
 * Whether any of the order's shipments is still waiting to reach its agency.
 *
 * Dispatch only advances shipments in `pending` — once every one is `assigned`
 * or further along, `POST /orders/:id/dispatch` is an accepted no-op, so the
 * action must stop being offered rather than sit at the top of an order that is
 * already with its agency. Reassigning an item can put a fresh `pending`
 * shipment back on the order, which correctly brings the action back.
 *
 * Returns `true` when no delivery info is loaded at all: the orders *list*
 * response carries none, and bulk dispatch there must stay available.
 */
function hasPendingShipment(order: Order): boolean {
  if (order.deliveries?.length) {
    return order.deliveries.some((d) => d.deliveryStatus === 'pending');
  }
  const withDelivery = order.items.filter((item) => item.delivery);
  if (withDelivery.length > 0) {
    return withDelivery.some((item) => item.delivery!.deliveryStatus === 'pending');
  }
  return true;
}

/** Whether a single order can be dispatched to its delivery agency right now. */
export function canDispatchOrder(order: Order): boolean {
  const paymentOk = order.paymentMethod === 'cash_on_delivery'
    ? COD_DISPATCHABLE_PAYMENT_STATUSES.includes(order.paymentStatus)
    : order.paymentStatus === 'paid';
  return (
    order.orderType === 'physical' &&
    paymentOk &&
    // The server refuses this one with `422 ORDER_PAYMENT_REQUIRED`.
    !isOnlinePartDue(order) &&
    !isOrderFrozen(order) &&
    !DISPATCH_TERMINAL_STATUSES.includes(order.status) &&
    hasPendingShipment(order)
  );
}

/** Intersection of `getEffectiveNextStatuses` across every given order — for bulk-action UIs. */
export function getCommonNextStatuses(orders: Order[]): VendorSettableStatus[] {
  if (orders.length === 0) return [];
  return orders.reduce<VendorSettableStatus[] | null>((acc, order) => {
    const next = getEffectiveNextStatuses(order);
    return acc === null ? next : acc.filter((s) => next.includes(s));
  }, null) ?? [];
}

/** Whether every given order can be dispatched — for bulk-action UIs. */
export function canBulkDispatch(orders: Order[]): boolean {
  return orders.length > 0 && orders.every(canDispatchOrder);
}

/** Full status list for the Orders filter sheet. */
export const ORDER_STATUS_FILTER_OPTIONS: { value: OrderStatus; labelKey: TranslationKey }[] = [
  { value: 'pending', labelKey: 'orders.status.pending' },
  { value: 'processing', labelKey: 'orders.status.processing' },
  { value: 'partially_shipped', labelKey: 'orders.status.partiallyShipped' },
  { value: 'shipped', labelKey: 'orders.status.shipped' },
  { value: 'partially_delivered', labelKey: 'orders.status.partiallyDelivered' },
  { value: 'delivered', labelKey: 'orders.status.delivered' },
  { value: 'fulfilled', labelKey: 'orders.status.fulfilled' },
  { value: 'cancelled', labelKey: 'orders.status.cancelled' },
  { value: 'returned', labelKey: 'orders.status.returned' },
];

/** Payment-method list for the Orders filter sheet. */
export const PAYMENT_METHOD_FILTER_OPTIONS: { value: PaymentMethod; labelKey: TranslationKey }[] = [
  { value: 'online', labelKey: 'orders.paymentMethod.online' },
  { value: 'cash_on_delivery', labelKey: 'orders.paymentMethod.cashOnDelivery' },
];

/** Payment-status list for the Orders filter sheet (mirrors the backend `paymentStatus` enum). */
export const PAYMENT_STATUS_FILTER_OPTIONS: { value: PaymentStatus; labelKey: TranslationKey }[] = [
  { value: 'pending', labelKey: 'orders.paymentStatus.pending' },
  { value: 'AWAITING_PAYMENT', labelKey: 'orders.paymentStatus.awaitingPayment' },
  { value: 'partially_paid', labelKey: 'orders.paymentStatus.partiallyPaid' },
  { value: 'paid', labelKey: 'orders.paymentStatus.paid' },
  { value: 'disputed', labelKey: 'orders.paymentStatus.disputed' },
  { value: 'failed', labelKey: 'orders.paymentStatus.failed' },
  { value: 'refunded', labelKey: 'orders.paymentStatus.refunded' },
];

/** Order-type list for the Orders filter sheet. */
export const ORDER_TYPE_FILTER_OPTIONS: { value: 'physical' | 'digital'; labelKey: TranslationKey }[] = [
  { value: 'physical', labelKey: 'orders.orderType.physical' },
  { value: 'digital', labelKey: 'orders.orderType.digital' },
];
