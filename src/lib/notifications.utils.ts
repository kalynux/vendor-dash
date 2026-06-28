import {
  Bell,
  ShoppingCart,
  PackageX,
  CalendarPlus,
  CalendarX2,
  CircleDollarSign,
  CheckCircle2,
  HardDrive,
  type LucideIcon,
} from 'lucide-react';
import type {
  VendorNotification,
  NotificationType,
  NotificationAggregateType,
} from '@/types/notifications.types';

/**
 * Absolute in-app route for a notification, derived from its aggregate.
 *
 * The backend also ships an `action.path` (e.g. `"orders/665f…"`), but that uses
 * the backend's own URL scheme which doesn't match our SPA routes (bookings live
 * under `services/appointments`, payments under `transactions`). So we build the
 * in-app link ourselves from `aggregateType` + `aggregateId` — the API explicitly
 * supports this. Order/booking links carry a `?view=<id>` that the section page
 * reads to auto-open that entity's detail; payment/storage have no detail view
 * and just land on the relevant section.
 */
export function notificationRoute(
  n: Pick<VendorNotification, 'aggregateType' | 'aggregateId'>,
): string {
  const view = n.aggregateId ? `?view=${encodeURIComponent(n.aggregateId)}` : '';
  switch (n.aggregateType) {
    case 'order':
      return `/dashboard/orders${view}`;
    case 'booking':
      return `/dashboard/services/appointments${view}`;
    case 'payment':
      return '/dashboard/transactions';
    case 'storage':
      return '/dashboard/media';
    default:
      return '/dashboard/notifications';
  }
}

/** Action-button label per aggregate, e.g. an order notification → "View order". */
const AGGREGATE_ACTION_LABEL: Record<NotificationAggregateType, string> = {
  order: 'View order',
  booking: 'View booking',
  payment: 'View transaction',
  storage: 'View storage',
};

/**
 * Label for a notification's action button, derived from the event's aggregate
 * (so a booking reads "View booking", a payment "View transaction", …). We build
 * this ourselves rather than trusting the backend's `action.label`, which can
 * come back as a generic "View order" for every event type.
 */
export function notificationActionLabel(
  n: Pick<VendorNotification, 'aggregateType'>,
): string {
  return (n.aggregateType && AGGREGATE_ACTION_LABEL[n.aggregateType]) || 'View details';
}

type Visual = { Icon: LucideIcon; iconWrap: string; dot: string };

const TYPE_VISUALS: Record<NotificationType, Visual> = {
  'order.created': { Icon: ShoppingCart, iconWrap: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  'order.cancelled': { Icon: PackageX, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  'booking.created': { Icon: CalendarPlus, iconWrap: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500' },
  'booking.cancelled': { Icon: CalendarX2, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  'payment.received.partial': { Icon: CircleDollarSign, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  'payment.received.full': { Icon: CheckCircle2, iconWrap: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  'storage.alert': { Icon: HardDrive, iconWrap: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
};

const AGGREGATE_FALLBACK: Record<NotificationAggregateType, Visual> = {
  order: { Icon: ShoppingCart, iconWrap: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  booking: { Icon: CalendarPlus, iconWrap: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500' },
  payment: { Icon: CircleDollarSign, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  storage: { Icon: HardDrive, iconWrap: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
};

const DEFAULT_VISUAL: Visual = { Icon: Bell, iconWrap: 'bg-gray-100 text-gray-600', dot: 'bg-gray-500' };

/** Icon + colour treatment for a notification, keyed off its `type`. */
export function notificationVisual(n: Pick<VendorNotification, 'type' | 'aggregateType'>): Visual {
  return TYPE_VISUALS[n.type] ?? (n.aggregateType ? AGGREGATE_FALLBACK[n.aggregateType] : undefined) ?? DEFAULT_VISUAL;
}

/** Relative "time ago" label for a notification timestamp. */
export function notificationTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
