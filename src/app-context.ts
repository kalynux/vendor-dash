/**
 * App-level context shims (sidebar collapse, legacy auth, legacy router).
 *
 * The providers are mounted by `App.tsx`; the contexts and hooks live here so
 * `App.tsx` exports only components and React Fast Refresh keeps working.
 */
import { createContext, useContext } from 'react';

// ─── Sidebar collapse context (preserved for Sidebar/Header compatibility) ────

export interface UIContextType {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** False in the tablet range, where the sidebar is force-collapsed to the
   *  icon rail and the manual collapse toggle is hidden. */
  collapsible: boolean;
}

export const UIContext = createContext<UIContextType>({
  sidebarCollapsed: false,
  toggleSidebar: () => { },
  collapsible: true,
});

export const useUI = () => useContext(UIContext);

// ─── Legacy auth context shim ─────────────────────────────────────────────────
// Sidebar and Header reference useAuth() from @/app-context. This shim re-exports a
// compatible context so those components compile without changes.

export interface LegacyAuthContextType {
  user: { id: string; name: string; email: string; role: string; avatar?: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
}

export const LegacyAuthContext = createContext<LegacyAuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => false,
  logout: () => { },
});

export const useAuth = () => useContext(LegacyAuthContext);

// ─── Legacy router context shim ───────────────────────────────────────────────
// Header/Sidebar use useRouter().navigate(route). Map legacy route strings to
// real URL paths.

export type LegacyRoute =
  | 'overview' | 'orders' | 'products' | 'product-upload' | 'inventory' | 'customers'
  | 'analytics' | 'notifications' | 'settings' | 'media' | 'tickets' | 'agency'
  | 'services' | 'service-upload' | 'login' | 'transactions' | 'account';

export const LEGACY_ROUTE_MAP: Record<LegacyRoute, string> = {
  overview: '/dashboard',
  orders: '/dashboard/orders',
  products: '/dashboard/products',
  'product-upload': '/dashboard/product-upload',
  inventory: '/dashboard/inventory',
  customers: '/dashboard/customers',
  analytics: '/dashboard/analytics',
  notifications: '/dashboard/notifications',
  settings: '/dashboard/settings',
  account: '/dashboard/account',
  media: '/dashboard/media',
  tickets: '/dashboard/tickets',
  agency: '/dashboard/agency',
  services: '/dashboard/services',
  'service-upload': '/dashboard/service-upload',
  login: '/login',
  transactions: '/dashboard/transactions',
};

// Reverse-map the current URL to a legacy route name so Sidebar/Header/MobileTabBar
// can highlight the active item. Product wizard routes map to 'products'.
export function pathToLegacyRoute(pathname: string): LegacyRoute {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'overview';
  if (
    pathname.startsWith('/dashboard/product-edit') ||
    pathname.startsWith('/dashboard/product-upload')
  ) {
    return 'products';
  }
  if (
    pathname.startsWith('/dashboard/service-upload') ||
    pathname.startsWith('/dashboard/service-edit')
  ) {
    return 'services';
  }
  const match = (Object.entries(LEGACY_ROUTE_MAP) as [LegacyRoute, string][])
    .filter(([key]) => key !== 'overview')
    .find(([, path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match ? match[0] : 'overview';
}

export interface LegacyRouterContextType {
  route: LegacyRoute;
  navigate: (route: LegacyRoute) => void;
}

export const LegacyRouterContext = createContext<LegacyRouterContextType>({
  route: 'overview',
  navigate: () => { },
});

export const useRouter = () => useContext(LegacyRouterContext);
