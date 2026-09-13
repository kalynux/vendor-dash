import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { NotificationsBootstrap } from '@/components/notifications/NotificationsBootstrap';
import { PageSkeleton } from '@/components/layout/RouteSkeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { useKeyboardOpen } from '@/platform/shell/keyboard';
import { cn } from '@/lib/utils';
import { useStoreStore } from '@/store';
import { useUI } from '@/App';
import { DeepLinkFallback } from '@/routes/DeepLinkFallback';
import {
    Account,
    Agency,
    Analytics,
    Customers,
    Inventory,
    MediaGallery,
    Notifications,
    Orders,
    Overview,
    ProductEdit,
    ProductUpload,
    Products,
    ServiceEdit,
    ServiceUpload,
    Services,
    Settings,
    SimpleProductCreate,
    SimpleProductEdit,
    Tickets,
    Transactions,
} from '@/routes/lazy';

/**
 * The signed-in, fully-onboarded shell and everything under `/dashboard/*`.
 *
 * Lives outside App.tsx so it can be one lazy chunk. The sidebar, the header,
 * the mobile tab bar and the notifications bootstrap are all dashboard-only,
 * and a vendor sitting on the login screen has no use for any of them. Leaving
 * this inside App.tsx would have split the 20 pages but kept the whole shell in
 * the entry bundle, which is most of the reason the split exists.
 *
 * Note that this does NOT move the Firebase SDK off the first frame: it is
 * eager through `onboarding.store` → `lib/fcm`, not through anything here.
 *
 * `useUI` still comes from App.tsx. That import is a cycle on paper — App
 * imports this module, this module imports App — but the edge back into App is
 * dynamic, so App has finished evaluating long before this chunk is fetched.
 * Sidebar and Header have imported `@/App` this way since before the split.
 */

/**
 * The bottom tab bar's three destinations, in the order they sit in the bar —
 * which is the order a sideways swipe walks them. The FAB and "More" are not
 * destinations, so they are not in the ring.
 */
const TAB_BAR_RING = ['/dashboard', '/dashboard/orders', '/dashboard/products'] as const;

export function DashboardShell() {
    const { sidebarCollapsed } = useUI();
    const isMobile = useIsMobile();
    // Always false on the web, so the browser build is unchanged (P3.2).
    const keyboardOpen = useKeyboardOpen();
    const { fetchStore } = useStoreStore();

    // Swipe left/right to move along the bottom tab bar. Inert off mobile, and
    // inert on any screen that is not one of the three — see `useRouteSwipe`.
    useRouteSwipe(TAB_BAR_RING);

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
                        {/* The boundary sits *inside* the shell on purpose: moving between
                            two dashboard pages should swap the content and leave the
                            sidebar, header and tab bar painted. A boundary above the shell
                            would blank the whole screen on every navigation. */}
                        <Suspense fallback={<PageSkeleton />}>
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
                                {/* Analytics' four views are routes, so a notification or a shared
                                    link can open one. The bare path renders the page too — it
                                    redirects itself, which is what carries the query string across. */}
                                <Route path="analytics" element={<Analytics />} />
                                <Route path="analytics/:tab" element={<Analytics />} />
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
                                <Route path="*" element={<DeepLinkFallback stripDashboard />} />
                            </Routes>
                        </Suspense>
                    </div>
                </main>
            </div>
            {isMobile && <MobileTabBar />}
        </div>
    );
}
