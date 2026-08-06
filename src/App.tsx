import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';

// Dashboard pages
import { Overview } from '@/pages/Overview';
import { Orders } from '@/pages/Orders';
import { Products } from '@/pages/Products';
import { Inventory } from '@/pages/Inventory';
import { Customers } from '@/pages/Customers';
import { Analytics } from '@/pages/Analytics';
import { Notifications } from '@/pages/Notifications';
import { Settings } from '@/pages/Settings';
import { Account } from '@/pages/Account';
import { Transactions } from '@/pages/Transactions';
import { MediaGallery } from '@/pages/MediaGallery';
import { ProductUpload } from '@/pages/ProductUpload';
import { ProductEdit } from '@/pages/ProductEdit';
import { SimpleProductCreate } from '@/pages/SimpleProductCreate';
import { SimpleProductEdit } from '@/pages/SimpleProductEdit';
import { Tickets } from '@/pages/Tickets';
import { Agency } from '@/pages/Agency';
import { Services } from '@/pages/Services';
import { ServiceUpload } from '@/pages/ServiceUpload';
import { ServiceEdit } from '@/pages/ServiceEdit';

// Layout
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { NotificationsBootstrap } from '@/components/notifications/NotificationsBootstrap';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// Onboarding system
import { OnboardingProvider } from '@/onboarding/store/onboarding.store';
import { OnboardingGuard } from '@/onboarding/OnboardingGuard';
import { OnboardingRouter } from '@/onboarding/OnboardingRouter';
import { OnboardingErrorBoundary } from '@/onboarding/OnboardingErrorBoundary';

// i18n — binds the dashboard language to the vendor's Profile setting
import { SessionLocaleSync, useTranslation } from '@/i18n';

// StoreStore for the vendor's storefront profile
import { useStoreStore } from '@/store';

// ─── Sidebar collapse context (preserved for Sidebar/Header compatibility) ────

interface UIContextType {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** False in the tablet range, where the sidebar is force-collapsed to the
   *  icon rail and the manual collapse toggle is hidden. */
  collapsible: boolean;
}

const UIContext = createContext<UIContextType>({
  sidebarCollapsed: false,
  toggleSidebar: () => { },
  collapsible: true,
});

export const useUI = () => useContext(UIContext);

// ─── Legacy auth context shim ─────────────────────────────────────────────────
// Sidebar and Header reference useAuth() from @/App. This shim re-exports a
// compatible context so those components compile without changes.

interface LegacyAuthContextType {
  user: { id: string; name: string; email: string; role: string; avatar?: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
}

const LegacyAuthContext = createContext<LegacyAuthContextType>({
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

type LegacyRoute =
  | 'overview' | 'orders' | 'products' | 'product-upload' | 'inventory' | 'customers'
  | 'analytics' | 'notifications' | 'settings' | 'media' | 'tickets' | 'agency'
  | 'services' | 'service-upload' | 'login' | 'transactions' | 'account';

const LEGACY_ROUTE_MAP: Record<LegacyRoute, string> = {
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
function pathToLegacyRoute(pathname: string): LegacyRoute {
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

interface LegacyRouterContextType {
  route: LegacyRoute;
  navigate: (route: LegacyRoute) => void;
}

const LegacyRouterContext = createContext<LegacyRouterContextType>({
  route: 'overview',
  navigate: () => { },
});

export const useRouter = () => useContext(LegacyRouterContext);

// ─── Dashboard shell ──────────────────────────────────────────────────────────

function DashboardShell() {
  const { sidebarCollapsed } = useUI();
  const isMobile = useIsMobile();
  const { fetchStore } = useStoreStore();

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  return (
    <div className="min-h-screen bg-background">
      <NotificationsBootstrap />
      {!isMobile && <Sidebar />}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-64',
        )}
      >
        {!isMobile && <Header />}
        <main className={cn('px-6 py-6 md:px-8 md:py-8', isMobile && 'pb-[calc(6rem_+_env(safe-area-inset-bottom))]')}>
          <div className="mx-auto w-full max-w-[1600px]">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="product-upload" element={<ProductUpload />} />
            {/* Nested under the same prefixes so pathToLegacyRoute keeps
                highlighting 'products' without needing a new entry. */}
            <Route path="product-upload/simple" element={<SimpleProductCreate />} />
            <Route path="product-edit/:id" element={<ProductEdit />} />
            <Route path="product-edit/:id/simple" element={<SimpleProductEdit />} />
            <Route path="customers" element={<Customers />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="account" element={<Navigate to="/dashboard/account/profile" replace />} />
            <Route path="account/:tab" element={<Account />} />
            <Route path="agency" element={<Navigate to="/dashboard/agency/connections" replace />} />
            <Route path="agency/:tab" element={<Agency />} />
            <Route path="settings" element={<Navigate to="/dashboard/settings/policies" replace />} />
            <Route path="settings/:tab" element={<Settings />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="media" element={<MediaGallery />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="services" element={<Services />} />
            <Route path="services/:tab" element={<Services />} />
            <Route path="service-upload" element={<ServiceUpload />} />
            <Route path="service-edit/:id" element={<ServiceEdit />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </div>
        </main>
      </div>
      {isMobile && <MobileTabBar />}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function AppContent() {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isTablet = useIsTablet();
  // In the tablet range the sidebar is pinned to its icon rail regardless of
  // the user's manual toggle, reclaiming horizontal space for content.
  const effectiveCollapsed = isTablet || sidebarCollapsed;
  const reactNavigate = useNavigate();
  const location = useLocation();
  const currentRoute = pathToLegacyRoute(location.pathname);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((p) => !p), []);

  // Legacy router shim — maps old string routes to real URL navigation
  const legacyNavigate = useCallback(
    (route: LegacyRoute) => {
      reactNavigate(LEGACY_ROUTE_MAP[route] ?? '/dashboard');
    },
    [reactNavigate],
  );

  // Legacy auth shim — expose enough shape for Sidebar/Header (they only read
  // user.name, user.email, user.role, user.avatar). Real auth lives in
  // OnboardingProvider which Sidebar does not access directly.
  const legacyUser = {
    id: 'vendor',
    name: t('nav.header.vendor'),
    email: '',
    role: 'vendor',
  };

  return (
    <LegacyAuthContext.Provider
      value={{
        user: legacyUser,
        isAuthenticated: true,
        isLoading: false,
        login: async () => false,
        logout: () => reactNavigate('/login'),
      }}
    >
      <LegacyRouterContext.Provider value={{ route: currentRoute, navigate: legacyNavigate }}>
        <UIContext.Provider value={{ sidebarCollapsed: effectiveCollapsed, toggleSidebar, collapsible: !isTablet }}>
          {/* The theme class is applied to <html> by StoreProvider — it has to
              sit above <body>, which carries `bg-background`/`text-foreground`. */}
          <>
            <OnboardingErrorBoundary>
              <OnboardingProvider>
                {/* Applies the vendor's saved language once the session loads. */}
                <SessionLocaleSync />
                <Routes>
                  {/* Login — placeholder, auth happens on example.com */}
                  <Route
                    path="/login"
                    element={
                      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                        <div className="text-center space-y-4 max-w-sm">
                          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                              <line x1="3" y1="6" x2="21" y2="6" />
                              <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                          </div>
                          <h1 className="text-2xl font-bold">{t('nav.login.title')}</h1>
                          <p className="text-muted-foreground text-sm">
                            {t('nav.login.description')}
                          </p>
                          <a
                            href="http://localhost:3000/login"
                            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors w-full"
                          >
                            {t('nav.login.goToLogin')}
                          </a>
                        </div>
                      </div>
                    }
                  />

                  {/* Onboarding — gated: must be authenticated, step > 0 */}
                  <Route
                    path="/onboarding/*"
                    element={
                      <OnboardingGuard>
                        <OnboardingRouter />
                      </OnboardingGuard>
                    }
                  />

                  {/* Dashboard — gated: must be authenticated AND fully onboarded */}
                  <Route
                    path="/dashboard/*"
                    element={
                      <OnboardingGuard requireComplete>
                        <DashboardShell />
                      </OnboardingGuard>
                    }
                  />

                  {/* Root redirect */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </OnboardingProvider>
            </OnboardingErrorBoundary>
            <Toaster richColors position="top-right" />
          </>
        </UIContext.Provider>
      </LegacyRouterContext.Provider>
    </LegacyAuthContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
