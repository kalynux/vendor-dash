import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { createContext, useContext, useCallback, useState, useEffect, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';

// Every route below is code-split. The map of which screen lands in which chunk
// — and why the three entry paths are split the way they are — lives in one
// place, `routes/lazy.ts`, rather than being spread across 22 import lines.
import {
  DashboardShell,
  ForgotPassword,
  LoginScreen,
  OnboardingRouter,
  ProductPreview,
  Register,
  ResetPassword,
  StorePreview,
  prefetchDashboard,
} from '@/routes/lazy';
import { DeepLinkFallback } from '@/routes/DeepLinkFallback';
import { ScreenSkeleton, ShellSkeleton } from '@/components/layout/RouteSkeleton';

import { useBearerAuth } from '@/platform/env';

// Layout
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { StatusBarScrim } from '@/components/layout/StatusBarScrim';
import { useIsTablet } from '@/hooks/use-mobile';

// Native shell behaviour (CAPACITOR-PLAN.md → Phase 3). Inert on the web: the
// back-button listener is only ever registered on Android. `useKeyboardOpen`
// moved to DashboardShell along with the `main` padding that reads it.
import { useHardwareBackButton } from '@/platform/shell/backButton';
// Deep links (P4.2). Also inert on the web — the listeners are only ever
// attached inside a native shell.
import { useDeepLinks } from '@/platform/shell/deepLinks';

// Onboarding system. The guard, the provider and the error boundary stay eager
// — they are what decides which of the three entry paths a vendor is on, so
// they run before any chunk can be chosen. Only `OnboardingRouter` is split,
// from `routes/lazy.ts`.
import { OnboardingProvider, useOnboarding } from '@/onboarding/store/onboarding.store';
import { OnboardingGuard } from '@/onboarding/OnboardingGuard';
import { OnboardingErrorBoundary } from '@/onboarding/OnboardingErrorBoundary';
import { OnboardingSkeleton } from '@/onboarding/OnboardingSkeleton';

// i18n — binds the dashboard language to the vendor's Profile setting
import { SessionLocaleSync, useTranslation } from '@/i18n';

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


// ─── Dashboard warm-up ────────────────────────────────────────────────────────

/**
 * Fetch the dashboard shell and Overview once the session says the vendor is
 * heading there.
 *
 * This matters more on a phone than it would on a desktop. The vendor is on a
 * connection that just made them wait for the login screen; making them wait
 * again, twice, after they tap sign in turns the split from a win into a
 * different stall. Fetching while they are still reading the form spends idle
 * time instead of theirs.
 *
 * Gated on a real session, so a signed-out vendor still downloads nothing of
 * the dashboard — that gate is the whole point of the split and this must not
 * quietly undo it. Gated on `currentStep === 0` too, because a vendor who is
 * mid-onboarding is going to `/onboarding`, not here.
 *
 * `requestIdleCallback` keeps the fetch behind whatever the current screen is
 * still doing; Safari and the older Android WebViews do not have it, hence the
 * timeout fallback. Renders nothing.
 */
function DashboardPrefetch() {
  const { session, currentStep, isInitializing } = useOnboarding();
  const ready = !isInitializing && !!session && currentStep === 0;

  useEffect(() => {
    if (!ready) return;
    const idle = window.requestIdleCallback;
    if (idle) {
      const handle = idle(() => prefetchDashboard(), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(prefetchDashboard, 300);
    return () => window.clearTimeout(handle);
  }, [ready]);

  return null;
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
            {/* Also outside the routes, and for the same reason: the status bar
                is drawn *over* every screen, so the band it occupies has to be
                painted on every screen — sign-in and onboarding included, not
                just the dashboard shell. Zero-height in a browser. */}
            <StatusBarScrim />
            {/* Outside the routes on purpose: "you are offline" is as true on
                the sign-in screen as it is on the dashboard, and that is the
                screen where mistaking it for a rejected password costs the
                most (P3.4). */}
            <OfflineBanner />
            <OnboardingErrorBoundary>
              <OnboardingProvider>
                {/* Applies the vendor's saved language once the session loads. */}
                <SessionLocaleSync />
                {/* Fetches the dashboard's first two chunks as soon as the
                    session says they will be needed. Renders nothing. */}
                <DashboardPrefetch />
                {/* The outer boundary. It catches the screens that own their
                    whole viewport — the auth pages and the two storefront
                    previews — and nothing else: `/onboarding/*` and
                    `/dashboard/*` each declare a boundary of their own below,
                    with a fallback shaped like the screen that is coming. React
                    uses the nearest boundary above the component that suspends,
                    so those win and this one never gets their loads. */}
                <Suspense fallback={<ScreenSkeleton />}>
                <Routes>
                  {/* Sign-in. On the web this is still the card that sends the
                      vendor to the main site, which is where authentication has
                      always happened; on a native build it is a real form,
                      because a packaged app has nowhere to come back to. The
                      choice lives in `pages/auth/index.tsx`, not here. */}
                  <Route path="/login" element={<LoginScreen />} />

                  {/* `/account/confirm-email` used to be routed here and is GONE.

                      The open question it was hedging against is closed: the
                      backend builds that link from `STOREFRONT_URL`, a single
                      variable with no role branch, so it has always pointed at
                      the main site and now points at a page there that serves
                      all four apps. This route was inert for its whole life.

                      Do not re-add it. The confirm endpoint reads no session and
                      syncs the new address onto every role profile the account
                      holds, so a copy here would have nothing to do differently
                      — it would only be a second place to get the POST-not-GET
                      rule wrong. The emailed link carries `app=vendor`, and the
                      main site's page uses it to send the vendor back here.
                      See jovi-mall api-doc/auth/FRONTEND-CHANGELOG-email-verification.md. */}

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

                  {/* Onboarding — gated: must be authenticated, step > 0.
                      Its own boundary, inside the guard: the guard already
                      renders `OnboardingSkeleton` while the session resolves,
                      so reusing it for the chunk makes the two waits one
                      continuous frame instead of two different placeholders in
                      a row. The four steps, their schemas and framer-motion —
                      which nothing outside `OnboardingLayout` imports — all
                      arrive with it. */}
                  <Route
                    path="/onboarding/*"
                    element={
                      <OnboardingGuard>
                        <Suspense fallback={<OnboardingSkeleton />}>
                          <OnboardingRouter />
                        </Suspense>
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

                  {/* Dashboard — gated: must be authenticated AND fully
                      onboarded. Its own boundary too, so the wait for the shell
                      shows the shell's chrome rather than the centred card the
                      outer fallback draws. Once the shell is mounted it owns a
                      second, inner boundary for the pages, which is what keeps
                      the sidebar painted across a navigation. */}
                  <Route
                    path="/dashboard/*"
                    element={
                      <OnboardingGuard requireComplete>
                        <Suspense fallback={<ShellSkeleton />}>
                          <DashboardShell />
                        </Suspense>
                      </OnboardingGuard>
                    }
                  />

                  {/* Root redirect */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Catch-all — tries the notification deep-link vocabulary
                      before falling back to the dashboard. */}
                  <Route path="*" element={<DeepLinkFallback />} />
                </Routes>
                </Suspense>
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
