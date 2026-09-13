import { Skeleton } from '@/components/ui/skeleton';
import { AppLogo } from '@/components/layout/AppLogo';

/**
 * The Suspense fallbacks for the route-level code splits in `routes/lazy.ts`.
 *
 * This app loads with skeletons, not spinners — `OnboardingSkeleton` sets the
 * pattern and every list surface follows it. A chunk arriving is the same event
 * as data arriving from the vendor's point of view, so it gets the same
 * treatment: the shape of the screen, greyed out, rather than a spinner that
 * says only "something is happening".
 *
 * All three use CSS breakpoints rather than `useIsMobile`. These render on the
 * very first frame of a cold load, which is the one frame where that hook has
 * not measured the viewport yet — a JS branch here would flash the wrong layout
 * before the real page even arrives.
 */

/**
 * A page inside the dashboard shell.
 *
 * Renders content only: the shell's `main` already supplies the padding and the
 * safe-area insets, and the sidebar, header and tab bar stay painted around it.
 * Navigating between two dashboard pages should look like the content area
 * reloading, because that is exactly what it is.
 */
export function PageSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true">
            {/* Page heading — every page opens with a title and a one-line
                description, on both breakpoints. */}
            <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64 max-w-full" />
            </div>

            {/* A toolbar row: search plus an action or two. */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 flex-1 max-w-sm rounded-md" />
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="hidden h-10 w-28 rounded-md md:block" />
            </div>

            {/* The body. Rows below `md` where every surface is a card list,
                a single panel above it. */}
            <div className="space-y-3 md:hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-2/5" />
                            <Skeleton className="h-3 w-3/5" />
                        </div>
                        <Skeleton className="h-4 w-12" />
                    </div>
                ))}
            </div>
            <Skeleton className="hidden h-80 w-full rounded-lg md:block" />
        </div>
    );
}

/**
 * The dashboard shell itself — the fallback while `DashboardShell` and its
 * layout components are in flight.
 *
 * Draws the chrome the shell is about to draw, so the sidebar and header do not
 * pop in underneath an already-settled page. This is the only frame where the
 * vendor sees the app without a real sidebar, so it paints the rail and the
 * header band rather than leaving the sides blank.
 */
export function ShellSkeleton() {
    return (
        <div className="min-h-screen bg-background" aria-busy="true">
            {/* Sidebar rail — matches Sidebar's `fixed left-0 top-0 w-64`. */}
            <div className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card md:block">
                <div className="flex h-16 items-center gap-2.5 border-b px-4">
                    <AppLogo className="h-8 w-8" />
                    <span className="text-sm font-bold leading-none">Wi-Mall</span>
                </div>
                <div className="space-y-2 p-4">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <Skeleton key={i} className="h-9 w-full rounded-md" />
                    ))}
                </div>
            </div>

            <div className="md:ml-64">
                {/* Header band — matches Header's `h-16 border-b`. */}
                <div className="hidden h-16 items-center justify-between border-b bg-card/50 px-6 md:flex">
                    <Skeleton className="h-9 w-64 rounded-md" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-md" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                </div>

                {/* Same paddings as the shell's `main`, insets included, so the
                    content does not shift when the real page lands. */}
                <main className="px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] md:px-8 md:pb-8 md:pt-[calc(2rem+env(safe-area-inset-top))]">
                    <div className="mx-auto w-full max-w-[1600px]">
                        <PageSkeleton />
                    </div>
                </main>
            </div>
        </div>
    );
}

/**
 * A full-screen route that owns its own layout: the auth screens and the two
 * storefront previews.
 *
 * The brand is painted for real rather than greyed out — it is known before any
 * chunk lands, and this is the app's first frame on a cold load. A placeholder
 * block there reads as a blank app. Same reasoning as `OnboardingSkeleton`,
 * which this deliberately echoes.
 */
export function ScreenSkeleton() {
    return (
        <div
            className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4"
            aria-busy="true"
        >
            <div className="flex flex-col items-center gap-3">
                <AppLogo alt="Wi-Mall" className="h-16 w-16" />
                <Skeleton className="h-5 w-40" />
            </div>
            <div className="w-full max-w-sm space-y-4">
                {[0, 1].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-11 w-full rounded-md" />
                    </div>
                ))}
                <Skeleton className="h-11 w-full rounded-lg" />
            </div>
        </div>
    );
}
