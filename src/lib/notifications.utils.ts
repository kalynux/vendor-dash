import {
  Bell,
  ShoppingCart,
  Package,
  PackageCheck,
  PackageSearch,
  PackageX,
  Ban,
  Warehouse,
  CalendarPlus,
  CalendarX2,
  CircleDollarSign,
  CheckCircle2,
  HardDrive,
  Handshake,
  Wallet,
  CalendarClock,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type {
  VendorNotification,
  NotificationType,
  NotificationAggregateType,
} from '@/types/notifications.types';
import type { TranslationKey } from '@/i18n';

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
    case 'connection':
      // Agency connections are managed under Agency → Connection.
      return '/dashboard/agency/connections';
    case 'payout':
      // A payout request is tracked as a ticket, but the notification's
      // aggregateId is the PayoutRequest id (not the ticket id), so land on the
      // payout screen rather than trying to build a ticket deep-link.
      return '/dashboard/account/payout';
    case 'plan':
      // Plan expiry / expired notifications land on the billing tab (plans live
      // there). aggregateId is the vendor id, so there's no per-entity view.
      return '/dashboard/account/billing';
    case 'stock_request':
      // The inbox is an Inventory sub-tab route; `view` opens that request's
      // sheet. The page strips the param on arrival so a refresh doesn't
      // reopen it.
      return n.aggregateId
        ? `/dashboard/inventory/requests?view=${encodeURIComponent(n.aggregateId)}`
        : '/dashboard/inventory/requests';
    case 'product':
      // storage.depot_changed / product_suspended / product_unsuspended.
      // Deep-link the editor rather than the list: `storage.product_suspended`
      // is the one to surface prominently, and dropping the vendor on an
      // unfiltered list doesn't answer "which product?". ProductEdit self-heals
      // to the simple editor for a simple product.
      return n.aggregateId
        ? `/dashboard/product-edit/${encodeURIComponent(n.aggregateId)}`
        : '/dashboard/products';
    default:
      return '/dashboard/notifications';
  }
}

/** Action-button label per aggregate, e.g. an order notification → "View order". */
const AGGREGATE_ACTION_LABEL: Record<NotificationAggregateType, TranslationKey> = {
  order: 'notifications.actionLabels.order',
  booking: 'notifications.actionLabels.booking',
  payment: 'notifications.actionLabels.payment',
  storage: 'notifications.actionLabels.storage',
  connection: 'notifications.actionLabels.connection',
  payout: 'notifications.actionLabels.payout',
  plan: 'notifications.actionLabels.plan',
  stock_request: 'notifications.actionLabels.stockRequest',
  product: 'notifications.actionLabels.product',
};

/**
 * Label for a notification's action button, derived from the event's aggregate
 * (so a booking reads "View booking", a payment "View transaction", …). We build
 * this ourselves rather than trusting the backend's `action.label`, which can
 * come back as a generic "View order" for every event type.
 *
 * Takes the translator as a parameter for the same reason `notificationTimeAgo`
 * below does: this module is imported from the header dropdown and the
 * notifications page and has no React context of its own.
 */
export function notificationActionLabel(
  n: Pick<VendorNotification, 'aggregateType'>,
  t: (key: TranslationKey) => string,
): string {
  return t(
    n.aggregateType
      ? AGGREGATE_ACTION_LABEL[n.aggregateType]
      : 'notifications.actionLabels.default',
  );
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
  'connection.request_received': { Icon: Handshake, iconWrap: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-500' },
  'connection.approved': { Icon: Handshake, iconWrap: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  'connection.rejected': { Icon: XCircle, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  'connection.reapproval_needed': { Icon: AlertTriangle, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  'payout.requested': { Icon: Wallet, iconWrap: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  'payout.paid': { Icon: Wallet, iconWrap: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  'payout.rejected': { Icon: Wallet, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  // Orange (not red) to match the "Needs Reassignment" delivery badge — this is an
  // action-required event: the vendor must reroute the declined item to another agency.
  'shipment.rejected': { Icon: PackageX, iconWrap: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
  // Amber while the plan is merely nearing expiry (warning); red once it has
  // actually expired (downgraded / handed over).
  'plan.expiring': { Icon: CalendarClock, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  'plan.expired': { Icon: CalendarClock, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  // Amber, not red: action-required, not a failure — same reasoning as
  // `shipment.rejected` above. The vendor has to answer this one.
  'storage.stock_request.received': { Icon: PackageSearch, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  'storage.stock_request.approved': { Icon: PackageCheck, iconWrap: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  'storage.stock_request.rejected': { Icon: PackageX, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  'storage.depot_changed': { Icon: Warehouse, iconWrap: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-500' },
  // Red: the product has LEFT the storefront and the agency's note is the only
  // explanation the vendor gets.
  'storage.product_suspended': { Icon: Ban, iconWrap: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  'storage.product_unsuspended': { Icon: CheckCircle2, iconWrap: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
};

const AGGREGATE_FALLBACK: Record<NotificationAggregateType, Visual> = {
  order: { Icon: ShoppingCart, iconWrap: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  booking: { Icon: CalendarPlus, iconWrap: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500' },
  payment: { Icon: CircleDollarSign, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  storage: { Icon: HardDrive, iconWrap: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
  connection: { Icon: Handshake, iconWrap: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-500' },
  payout: { Icon: Wallet, iconWrap: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  plan: { Icon: CalendarClock, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  stock_request: { Icon: PackageSearch, iconWrap: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  product: { Icon: Package, iconWrap: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
};

const DEFAULT_VISUAL: Visual = { Icon: Bell, iconWrap: 'bg-gray-100 text-gray-600', dot: 'bg-gray-500' };

/** Icon + colour treatment for a notification, keyed off its `type`. */
export function notificationVisual(n: Pick<VendorNotification, 'type' | 'aggregateType'>): Visual {
  return TYPE_VISUALS[n.type] ?? (n.aggregateType ? AGGREGATE_FALLBACK[n.aggregateType] : undefined) ?? DEFAULT_VISUAL;
}

/**
 * Relative "time ago" label for a notification timestamp.
 *
 * Takes the translator and a bound date formatter as parameters rather than
 * reaching for hooks: this module is imported from both the header dropdown and
 * the notifications page, and has no React context of its own. Passing
 * `fmt.date` (not `toLocaleDateString`) keeps the fallback on the dashboard's
 * locale instead of the browser's.
 */
export function notificationTimeAgo(
  dateStr: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  formatDate: (iso: string) => string,
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t('notifications.time.justNow');
  if (minutes < 60) return t('notifications.time.minutesAgo', { count: minutes });
  if (hours < 24) return t('notifications.time.hoursAgo', { count: hours });
  if (days < 7) return t('notifications.time.daysAgo', { count: days });
  return formatDate(dateStr);
}
