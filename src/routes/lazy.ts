/**
 * Every route-level code split in one place.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 *
 * The app used to ship as a single 3.3 MB bundle: the product wizard, the rich
 * text editor, recharts, the booking calendar and the media gallery were all
 * parsed and compiled before the login screen could paint. On the mobile
 * networks this dashboard targets that is seconds of white screen, and inside
 * the APK it is parse cost paid at every cold start.
 *
 * The split follows the three entry paths in `App.tsx`, because those are the
 * three states a vendor can actually be in:
 *
 *   auth        — signed out. Must not pull the dashboard or onboarding.
 *   onboarding  — signed in, not finished. Owns framer-motion (~338 kB raw,
 *                 and nothing outside `OnboardingLayout` imports it).
 *   dashboard   — signed in and complete. Owns the shell (sidebar, header, tab
 *                 bar, the notifications bootstrap and its Firebase messaging
 *                 dependency) plus one chunk per page.
 *
 * ── Why the pages are wrapped rather than imported ────────────────────────────
 *
 * None of the 22 page modules has a default export — they are all named. That
 * is deliberate elsewhere in the codebase, so the `.then()` unwrap lives here
 * instead of 22 files growing a default export they do not otherwise want.
 *
 * ── Calling `lazy()` at module scope is load-bearing ──────────────────────────
 *
 * These must stay at module scope. A `lazy()` created inside a render is a new
 * component type on every render, which remounts the page and throws away its
 * state on every parent update. Declaring them here also means the `import()`
 * calls are visible to Rollup as split points while staying uncalled until a
 * route actually renders — building the element does not load the chunk, only
 * mounting it does.
 */

import { lazy } from 'react';

// ─── Auth screens ─────────────────────────────────────────────────────────────
// All four come from the same barrel, which statically imports `Login`, so they
// share one chunk. That is the intent: a vendor on `/login` who taps "forgot
// password" should not wait on a second request.

export const LoginScreen = lazy(() =>
    import('@/pages/auth').then((m) => ({ default: m.LoginScreen })),
);
export const Register = lazy(() =>
    import('@/pages/auth').then((m) => ({ default: m.Register })),
);
export const ForgotPassword = lazy(() =>
    import('@/pages/auth').then((m) => ({ default: m.ForgotPassword })),
);
export const ResetPassword = lazy(() =>
    import('@/pages/auth').then((m) => ({ default: m.ResetPassword })),
);

// ─── Onboarding ───────────────────────────────────────────────────────────────
// The guard stays eager — it is what decides whether any of this is needed, and
// it renders `OnboardingSkeleton` while the session resolves. Only the router
// (and through it the four steps, their schemas and framer-motion) is split.

export const OnboardingRouter = lazy(() =>
    import('@/onboarding/OnboardingRouter').then((m) => ({ default: m.OnboardingRouter })),
);

// ─── Dashboard shell ──────────────────────────────────────────────────────────
// The shell, not just the pages. Sidebar, Header, MobileTabBar and
// NotificationsBootstrap are dashboard-only, so a signed-out vendor has no
// reason to download them.

export const DashboardShell = lazy(() =>
    import('@/components/layout/DashboardShell').then((m) => ({ default: m.DashboardShell })),
);

// ─── Storefront previews ──────────────────────────────────────────────────────
// Gated like the dashboard but rendered outside the shell — see App.tsx.

export const ProductPreview = lazy(() =>
    import('@/pages/ProductPreview').then((m) => ({ default: m.ProductPreview })),
);
export const StorePreview = lazy(() =>
    import('@/pages/StorePreview').then((m) => ({ default: m.StorePreview })),
);

// ─── Dashboard pages ──────────────────────────────────────────────────────────

export const Overview = lazy(() =>
    import('@/pages/Overview').then((m) => ({ default: m.Overview })),
);
export const Orders = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.Orders })));
export const Products = lazy(() =>
    import('@/pages/Products').then((m) => ({ default: m.Products })),
);
export const Inventory = lazy(() =>
    import('@/pages/Inventory').then((m) => ({ default: m.Inventory })),
);
export const Customers = lazy(() =>
    import('@/pages/Customers').then((m) => ({ default: m.Customers })),
);
export const Analytics = lazy(() =>
    import('@/pages/Analytics').then((m) => ({ default: m.Analytics })),
);
export const Notifications = lazy(() =>
    import('@/pages/Notifications').then((m) => ({ default: m.Notifications })),
);
export const Settings = lazy(() =>
    import('@/pages/Settings').then((m) => ({ default: m.Settings })),
);
export const Account = lazy(() => import('@/pages/Account').then((m) => ({ default: m.Account })));
export const Transactions = lazy(() =>
    import('@/pages/Transactions').then((m) => ({ default: m.Transactions })),
);
export const MediaGallery = lazy(() =>
    import('@/pages/MediaGallery').then((m) => ({ default: m.MediaGallery })),
);
export const ProductUpload = lazy(() =>
    import('@/pages/ProductUpload').then((m) => ({ default: m.ProductUpload })),
);
export const ProductEdit = lazy(() =>
    import('@/pages/ProductEdit').then((m) => ({ default: m.ProductEdit })),
);
export const SimpleProductCreate = lazy(() =>
    import('@/pages/SimpleProductCreate').then((m) => ({ default: m.SimpleProductCreate })),
);
export const SimpleProductEdit = lazy(() =>
    import('@/pages/SimpleProductEdit').then((m) => ({ default: m.SimpleProductEdit })),
);
export const Tickets = lazy(() => import('@/pages/Tickets').then((m) => ({ default: m.Tickets })));
export const Agency = lazy(() => import('@/pages/Agency').then((m) => ({ default: m.Agency })));
export const Services = lazy(() =>
    import('@/pages/Services').then((m) => ({ default: m.Services })),
);
export const ServiceUpload = lazy(() =>
    import('@/pages/ServiceUpload').then((m) => ({ default: m.ServiceUpload })),
);
export const ServiceEdit = lazy(() =>
    import('@/pages/ServiceEdit').then((m) => ({ default: m.ServiceEdit })),
);

// ─── Warm-up ──────────────────────────────────────────────────────────────────

/**
 * Pull the dashboard's first screen down before it is asked for.
 *
 * On a phone the shell and Overview are two round trips the vendor would
 * otherwise wait through *after* tapping sign in, on the same connection that
 * just made them wait for the login screen. Fetching them while they are still
 * reading the form turns the first navigation from a stall into a paint.
 *
 * Deliberately not everything — only the two chunks that are certain to be
 * needed next. Prefetching all 20 pages would just rebuild the bundle we split.
 *
 * Safe to call repeatedly: `import()` caches by specifier, so every call after
 * the first resolves from the module registry. The specifiers must stay
 * character-identical to the ones above or the registry treats them as two
 * different modules and the warm-up buys nothing.
 */
export function prefetchDashboard(): void {
    void import('@/components/layout/DashboardShell');
    void import('@/pages/Overview');
}
