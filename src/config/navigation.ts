import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  AlertTriangle,
  Lock,
  History,
  PackageSearch,
  Users,
  BarChart3,
  Settings,
  Store,
  MapPin,
  Bell,
  Shield,
  ShieldCheck,
  User,
  CreditCard,
  Image as ImageIcon,
  Ticket,
  CalendarClock,
  CalendarDays,
  CalendarCheck,
  Wallet,
  Truck,
  Link2,
  Search,
  Star,
  ScrollText,
  Receipt,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

import type { TranslationKey } from '@/i18n';

/**
 * Single source of truth for the dashboard navigation.
 *
 * Every menu and submenu is a real route (absolute `/dashboard/...` path).
 * `disabled` is supported at both levels so items can be plan-gated later by
 * flipping a single flag — disabled items render greyed and are non-clickable.
 *
 * Labels are translation *keys*, not text. This module is read by the desktop
 * Sidebar, the MobileTabBar and the MobileMoreDrawer; resolving the key at
 * render time is what re-labels all three the instant the language changes.
 * `id` is the stable identity (React keys, expand-state maps) that `name` used
 * to serve — a translated label cannot play that role.
 *
 * Consumed by the desktop Sidebar and the MobileMoreDrawer.
 */

/**
 * Which live counter decorates an item.
 *
 * `verification` is not a count — it resolves to 1 or 0, meaning "a rejected
 * identity submission is waiting for you" or nothing. It rides the same badge
 * mechanism because a single attention dot and a count of one render
 * identically, and a second decoration system for one item is not worth its
 * weight.
 */
export type NavBadge = 'orders' | 'notifications' | 'verification';

export interface NavChild {
  id: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Absolute route this child navigates to. */
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
}

export interface NavItem {
  id: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Absolute route. For a parent with children this is its default child route. */
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
  children?: NavChild[];
}

// ─── Top group (scrolls) ──────────────────────────────────────────────────────

export const PRIMARY_NAV: NavItem[] = [
  { id: 'overview', labelKey: 'nav.items.overview', path: '/dashboard', icon: LayoutDashboard },
  { id: 'orders', labelKey: 'nav.items.orders', path: '/dashboard/orders', icon: ShoppingCart, badge: 'orders' },
  { id: 'products', labelKey: 'nav.items.products', path: '/dashboard/products', icon: Package },
  {
    id: 'inventory',
    labelKey: 'nav.items.inventory',
    path: '/dashboard/inventory',
    icon: Boxes,
    // Labelled from `inventory.tabs.*` rather than `nav.items.*`: the page header
    // and the mobile pill strip read the same keys, so the three can't drift.
    children: [
      { id: 'inventory-alerts', labelKey: 'inventory.tabs.alerts', path: '/dashboard/inventory/alerts', icon: AlertTriangle },
      { id: 'inventory-reservations', labelKey: 'inventory.tabs.reservations', path: '/dashboard/inventory/reservations', icon: Lock },
      { id: 'inventory-history', labelKey: 'inventory.tabs.history', path: '/dashboard/inventory/history', icon: History },
      { id: 'inventory-requests', labelKey: 'inventory.tabs.requests', path: '/dashboard/inventory/requests', icon: PackageSearch },
      // Warehousing rent an agency charges for holding stock — NOT the plan's
      // media-storage quota, which lives on Account › Billing under the same word.
      { id: 'inventory-invoices', labelKey: 'inventory.tabs.invoices', path: '/dashboard/inventory/invoices', icon: Receipt },
    ],
  },
  {
    id: 'bookings',
    labelKey: 'nav.items.bookings',
    path: '/dashboard/services',
    icon: CalendarClock,
    children: [
      { id: 'services', labelKey: 'nav.items.services', path: '/dashboard/services', icon: CalendarClock },
      { id: 'appointments', labelKey: 'nav.items.appointments', path: '/dashboard/services/appointments', icon: CalendarDays },
      { id: 'calendar', labelKey: 'nav.items.calendar', path: '/dashboard/services/calendar', icon: CalendarCheck },
    ],
  },
  { id: 'media', labelKey: 'nav.items.media', path: '/dashboard/media', icon: ImageIcon },
  { id: 'customers', labelKey: 'nav.items.customers', path: '/dashboard/customers', icon: Users },
  { id: 'transactions', labelKey: 'nav.items.transactions', path: '/dashboard/transactions', icon: Receipt },
  { id: 'analytics', labelKey: 'nav.items.analytics', path: '/dashboard/analytics', icon: BarChart3 },
  { id: 'notifications', labelKey: 'nav.items.notifications', path: '/dashboard/notifications', icon: Bell, badge: 'notifications' },
  { id: 'tickets', labelKey: 'nav.items.tickets', path: '/dashboard/tickets', icon: Ticket },
  {
    id: 'agency',
    labelKey: 'nav.items.agency',
    path: '/dashboard/agency',
    icon: Truck,
    children: [
      { id: 'agency-connection', labelKey: 'nav.items.connection', path: '/dashboard/agency/connections', icon: Link2 },
      { id: 'agency-browse', labelKey: 'nav.items.browse', path: '/dashboard/agency/browse', icon: Search },
      // Deliveries this vendor has rated. Read-only and write-once — the rating
      // itself is submitted from the order, not from here.
      { id: 'agency-reviews', labelKey: 'nav.items.deliveryReviews', path: '/dashboard/agency/reviews', icon: Star },
    ],
  },
];

// ─── Bottom group (pinned above Platform Status) ──────────────────────────────

export const FOOTER_NAV: NavItem[] = [
  {
    id: 'account',
    labelKey: 'nav.items.account',
    path: '/dashboard/account',
    icon: UserCog,
    // Mirrors the Verification child's badge onto the parent, because the parent
    // is all you can see in the two places that matter: the collapsed icon rail,
    // and the mobile More drawer, where a group's children stay folded until
    // tapped. A rejection behind a closed group is a rejection nobody reads.
    badge: 'verification',
    children: [
      { id: 'account-profile', labelKey: 'nav.items.profile', path: '/dashboard/account/profile', icon: User },
      { id: 'account-store', labelKey: 'nav.items.store', path: '/dashboard/account/store', icon: Store },
      { id: 'account-addresses', labelKey: 'nav.items.addresses', path: '/dashboard/account/addresses', icon: MapPin },
      { id: 'account-verification', labelKey: 'nav.items.verification', path: '/dashboard/account/verification', icon: ShieldCheck, badge: 'verification' },
      { id: 'account-security', labelKey: 'nav.items.security', path: '/dashboard/account/security', icon: Shield, disabled: false },
      { id: 'account-billing', labelKey: 'nav.items.billing', path: '/dashboard/account/billing', icon: CreditCard },
      { id: 'account-payout', labelKey: 'nav.items.payout', path: '/dashboard/account/payout', icon: Wallet },
    ],
  },
  {
    id: 'settings',
    labelKey: 'nav.items.settings',
    path: '/dashboard/settings',
    icon: Settings,
    children: [
      { id: 'settings-policies', labelKey: 'nav.items.policies', path: '/dashboard/settings/policies', icon: ScrollText },
      { id: 'settings-notifications', labelKey: 'nav.items.notifications', path: '/dashboard/settings/notifications', icon: Bell },
      { id: 'settings-preferences', labelKey: 'nav.items.preferences', path: '/dashboard/settings/preferences', icon: SlidersHorizontal },
    ],
  },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...FOOTER_NAV];
