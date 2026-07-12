import type { ElementType } from 'react';
import { PackageSearch, XCircle } from 'lucide-react';
import { isOrderFrozen } from '@/services/orders.service';
import type { Order, OrderStatus, VendorSettableStatus } from '@/types';

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

/** Whether a single order can be dispatched to its delivery agency right now. */
export function canDispatchOrder(order: Order): boolean {
  return (
    order.orderType === 'physical' &&
    order.paymentStatus === 'paid' &&
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
