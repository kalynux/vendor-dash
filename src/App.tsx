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
import { ProductPreview } from '@/pages/ProductPreview';
import { StorePreview } from '@/pages/StorePreview';

// Auth screens — see pages/auth/index.tsx for which transport gets which.
import { LoginScreen, Register, ForgotPassword, ResetPassword } from '@/pages/auth';
import { useBearerAuth } from '@/platform/env';

// Layout
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { NotificationsBootstrap } from '@/components/notifications/NotificationsBootstrap';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// Native shell behaviour (CAPACITOR-PLAN.md → Phase 3). Both are inert on the
// web: `useKeyboardOpen` is hardwired to false there, and the back-button
// listener is only ever registered on Android.
import { useHardwareBackButton } from '@/platform/shell/backButton';
import { useKeyboardOpen } from '@/platform/shell/keyboard';
// Deep links (P4.2). Also inert on the web — the listeners are only ever
// attached inside a native shell.
import { useDeepLinks } from '@/platform/shell/deepLinks';

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
  // Always false on the web, so the browser build is unchanged (P3.2).
  const keyboardOpen = useKeyboardOpen();
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
        <main
          className={cn(
            'px-6 pb-6 md:px-8 md:pb-8',
            // The shell draws edge to edge on a device, so the status bar sits
            // *over* the top of this column and the first 1.5rem of content
            // would be under the clock (P3.3). The eleven pages that render a
            // `MobilePageHeader` cancel this again from inside that component —
            // it, not this, owns the visible inset, because it is the thing that
            // touches the top of the viewport once the page is scrolled.
            // `env(...)` is 0 in every browser, so the web is untouched.
            'pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-[calc(2rem+env(safe-area-inset-top))]',
            // Room for the tab bar, its safe-area inset and the FAB that pops
            // above it — and none of it while the keyboard is up, because the
            // tab bar hides itself then and the allowance would be dead space
            // between the content and the keys (P3.2).
            isMobile && !keyboardOpen && 'pb-[calc(6rem_+_env(safe-area-inset-bottom))]',
          )}
        >
          <div className="mx-auto w-full max-w-[1600px]">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="products" element={<Products />} />
            {/* Inventory's four surfaces are sidebar sub-tabs, so each is a real
                route. The bare path renders the page too — it redirects itself,
                which is what carries `?view=` (and the legacy `?tab=`) across. */}
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/:tab" element={<Inventory />} />
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

  // Android's hardware back button: close an open sheet, else go back, else
  // confirm before exiting. Has to be inside the Router, and is a no-op
  // everywhere but Android (CAPACITOR-PLAN.md → P3.1).
  useHardwareBackButton();

  // URLs handed to the app from outside the WebView land on the screen they
  // name — the Google Calendar OAuth return, and notification taps. Must be
  // inside the Router; a no-op off native. The listeners themselves live at
  // module scope in `deepLinks.ts`, because a cold-start notification tap
  // replays before React has mounted; this hook only flushes what already
  // arrived (CAPACITOR-PLAN.md → P4.2).
  useDeepLinks();

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
            {/* Outside the routes on purpose: "you are offline" is as true on
                the sign-in screen as it is on the dashboard, and that is the
                screen where mistaking it for a rejected password costs the
                most (P3.4). */}
            <OfflineBanner />
            <OnboardingErrorBoundary>
              <OnboardingProvider>
                {/* Applies the vendor's saved language once the session loads. */}
                <SessionLocaleSync />
                <Routes>
                  {/* Sign-in. On the web this is still the card that sends the
                      vendor to the main site, which is where authentication has
                      always happened; on a native build it is a real form,
                      because a packaged app has nowhere to come back to. The
                      choice lives in `pages/auth/index.tsx`, not here. */}
                  <Route path="/login" element={<LoginScreen />} />

                  {/* The other three auth screens exist only for the transport
                      that has no main site to fall back on. Rendering them on
                      the web would be a second front door to an app whose web
                      front door is elsewhere — so they redirect there instead,
                      and `useBearerAuth` is the single switch that changes it. */}
                  {useBearerAuth ? (
                    <>
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                    </>
                  ) : (
                    <>
                      <Route path="/register" element={<Navigate to="/login" replace />} />
                      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
                      <Route path="/reset-password" element={<Navigate to="/login" replace />} />
                    </>
                  )}

                  {/* Onboarding — gated: must be authenticated, step > 0 */}
                  <Route
                    path="/onboarding/*"
                    element={
                      <OnboardingGuard>
                        <OnboardingRouter />
                      </OnboardingGuard>
                    }
                  />

                  {/* Storefront preview — gated like the dashboard, but rendered
                      outside DashboardShell. The page it embeds lays itself out
                      against the viewport, so the sidebar, header and padded
                      `main` would squeeze it into something that is no longer a
                      faithful preview. Same reasoning as /onboarding/*. */}
                  <Route
                    path="/preview/product/:id"
                    element={
                      <OnboardingGuard requireComplete>
                        <ProductPreview />
                      </OnboardingGuard>
                    }
                  />
                  <Route
                    path="/preview/store"
                    element={
                      <OnboardingGuard requireComplete>
                        <StorePreview />
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
            {/* The status bar is drawn over the app on a device, so sonner's
                own 24px / 16px offset would put a toast under the clock. A
                partial offset object keeps its defaults on the other three
                sides, and `env(...)` is 0 in a browser — so the web keeps
                exactly the placement it has today (P3.3). */}
            <Toaster
              richColors
              position="top-right"
              offset={{ top: 'calc(24px + env(safe-area-inset-top))' }}
              mobileOffset={{ top: 'calc(16px + env(safe-area-inset-top))' }}
            />
          </>
        </UIContext.Provider>
      </LegacyRouterContext.Provider>
    </LegacyAuthContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
