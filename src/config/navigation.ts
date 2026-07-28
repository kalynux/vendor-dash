import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  BarChart3,
  Settings,
  Store,
  MapPin,
  Bell,
  Shield,
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
  ScrollText,
  Receipt,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for the dashboard navigation.
 *
 * Every menu and submenu is a real route (absolute `/dashboard/...` path).
 * `disabled` is supported at both levels so items can be plan-gated later by
 * flipping a single flag — disabled items render greyed and are non-clickable.
 *
 * Consumed by the desktop Sidebar and the MobileMoreDrawer.
 */

export type NavBadge = 'orders' | 'notifications';

export interface NavChild {
  name: string;
  icon: LucideIcon;
  /** Absolute route this child navigates to. */
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
}

export interface NavItem {
  name: string;
  icon: LucideIcon;
  /** Absolute route. For a parent with children this is its default child route. */
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
  children?: NavChild[];
}

// ─── Top group (scrolls) ──────────────────────────────────────────────────────

export const PRIMARY_NAV: NavItem[] = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Orders', path: '/dashboard/orders', icon: ShoppingCart, badge: 'orders' },
  { name: 'Products', path: '/dashboard/products', icon: Package },
  { name: 'Inventory', path: '/dashboard/inventory', icon: Boxes },
  {
    name: 'Bookings',
    path: '/dashboard/services',
    icon: CalendarClock,
    children: [
      { name: 'Services', path: '/dashboard/services', icon: CalendarClock },
      { name: 'Appointments', path: '/dashboard/services/appointments', icon: CalendarDays },
      { name: 'Calendar', path: '/dashboard/services/calendar', icon: CalendarCheck },
    ],
  },
  { name: 'Media', path: '/dashboard/media', icon: ImageIcon },
  { name: 'Customers', path: '/dashboard/customers', icon: Users },
  { name: 'Transactions', path: '/dashboard/transactions', icon: Receipt },
  { name: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Notifications', path: '/dashboard/notifications', icon: Bell, badge: 'notifications' },
  { name: 'Tickets', path: '/dashboard/tickets', icon: Ticket },
  {
    name: 'Agency',
    path: '/dashboard/agency',
    icon: Truck,
    children: [
      { name: 'Connection', path: '/dashboard/agency/connections', icon: Link2 },
      { name: 'Browse', path: '/dashboard/agency/browse', icon: Search },
    ],
  },
];

// ─── Bottom group (pinned above Platform Status) ──────────────────────────────

export const FOOTER_NAV: NavItem[] = [
  {
    name: 'Account',
    path: '/dashboard/account',
    icon: UserCog,
    children: [
      { name: 'Profile', path: '/dashboard/account/profile', icon: User },
      { name: 'Store', path: '/dashboard/account/store', icon: Store },
      { name: 'Addresses', path: '/dashboard/account/addresses', icon: MapPin },
      { name: 'Security', path: '/dashboard/account/security', icon: Shield, disabled: false },
      { name: 'Billing', path: '/dashboard/account/billing', icon: CreditCard },
      { name: 'Payout Setup', path: '/dashboard/account/payout', icon: Wallet },
    ],
  },
  {
    name: 'Settings',
    path: '/dashboard/settings',
    icon: Settings,
    children: [
      { name: 'Policies', path: '/dashboard/settings/policies', icon: ScrollText },
      { name: 'Notifications', path: '/dashboard/settings/notifications', icon: Bell },
      { name: 'Preferences', path: '/dashboard/settings/preferences', icon: SlidersHorizontal },
    ],
  },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...FOOTER_NAV];
