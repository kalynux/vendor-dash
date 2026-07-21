import type { ElementType } from 'react';
import { PackageSearch, XCircle } from 'lucide-react';
import { isOrderFrozen } from '@/services/orders.service';
import type { Order, OrderStatus, PaymentMethod, PaymentStatus, VendorSettableStatus } from '@/types';

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

export const STATUS_LABELS: Record<VendorSettableStatus, string> = {
  pending: 'Mark as Pending',
  processing: 'Mark as Processing',
  cancelled: 'Cancel Order',
};

export const STATUS_ICONS: Record<VendorSettableStatus, ElementType> = {
  pending: PackageSearch,
  processing: PackageSearch,
  cancelled: XCircle,
};

/** `getNextStatuses`, additionally accounting for a dispute-frozen order (no moves allowed). */
export function getEffectiveNextStatuses(order: Order): VendorSettableStatus[] {
  return isOrderFrozen(order) ? [] : getNextStatuses(order.status);
}

const DISPATCH_TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'delivered', 'returned', 'fulfilled'];

/**
 * Cash-on-delivery orders invert the payment/fulfilment sequence — they fulfil (and can be
 * dispatched to a delivery agency) before payment, getting paid per shipment as the agent
 * collects cash. Online orders keep the old rule: must be `paid` before dispatch.
 */
const COD_DISPATCHABLE_PAYMENT_STATUSES: PaymentStatus[] = ['AWAITING_PAYMENT', 'partially_paid', 'paid'];

/** Whether a single order can be dispatched to its delivery agency right now. */
export function canDispatchOrder(order: Order): boolean {
  const paymentOk = order.paymentMethod === 'cash_on_delivery'
    ? COD_DISPATCHABLE_PAYMENT_STATUSES.includes(order.paymentStatus)
    : order.paymentStatus === 'paid';
  return (
    order.orderType === 'physical' &&
    paymentOk &&
    !isOrderFrozen(order) &&
    !DISPATCH_TERMINAL_STATUSES.includes(order.status)
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
export const ORDER_STATUS_FILTER_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'partially_shipped', label: 'Partially Shipped' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

/** Payment-method list for the Orders filter sheet. */
export const PAYMENT_METHOD_FILTER_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'cash_on_delivery', label: 'Cash on Delivery' },
];

/** Payment-status list for the Orders filter sheet (mirrors the backend `paymentStatus` enum). */
export const PAYMENT_STATUS_FILTER_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting Payment' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

/** Order-type list for the Orders filter sheet. */
export const ORDER_TYPE_FILTER_OPTIONS: { value: 'physical' | 'digital'; label: string }[] = [
  { value: 'physical', label: 'Physical' },
  { value: 'digital', label: 'Digital' },
];
