/**
 * The opaque strip the status bar sits on.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The shell draws edge to edge (P3.3): the status bar is not a bar the app is
 * laid out beneath, it is a transparent strip of *icons* — clock, battery,
 * signal — floating over the app's own pixels. Padding keeps content from
 * *starting* under it, which is what every `env(safe-area-inset-top)` in this
 * codebase does, but padding cannot stop content from *scrolling* under it. So
 * on any scrolled page the vendor sees their own list items sliding behind the
 * clock, which is what "the top bar is mixed up with the app's content" means.
 *
 * The fix is a fixed, opaque band exactly as tall as the inset, painted in the
 * app's ground colour, sitting above everything that scrolls. `OfflineBanner`
 * already did precisely this while it was up — this is the same idea, always on.
 *
 * ── Why not do it natively ───────────────────────────────────────────────────
 *
 * `StatusBar.setBackgroundColor` is the obvious answer and it is unavailable on
 * Android 15+ (see `platform/shell/statusBar.ts`, which documents why neither it
 * nor `setOverlaysWebView` may be called). Painting it from the web layer also
 * means the strip follows `--background` through a theme switch for free, with
 * no second source of truth for the colour.
 *
 * ── The z-index ──────────────────────────────────────────────────────────────
 *
 * `z-40` is deliberately between two things:
 *   - above `MobilePageHeader` (`z-30`), which is `sticky` and whose own
 *     translucent `bg-background/95` would otherwise let content show through
 *     the band once the page is scrolled;
 *   - below `OfflineBanner` and every Radix overlay (`z-50`), because while a
 *     modal or the offline bar is up, *it* owns the top of the screen and
 *     covering it with the app ground would be wrong.
 *
 * Inert on the web: `env(safe-area-inset-top)` is 0 in a browser, so this is a
 * zero-height element and the web build is unchanged (ground rule 3).
 */
export function StatusBarScrim() {
  return (
    <div
      aria-hidden
      // `pointer-events-none` so it can never eat a tap meant for whatever sits
      // under it — a sticky header's back button on a device with a tall inset
      // is the case that matters.
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-safe-top bg-background"
    />
  );
}
