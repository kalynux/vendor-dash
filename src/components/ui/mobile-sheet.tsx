import { cn } from '@/lib/utils';

/**
 * Turning a Radix popper surface into a bottom sheet, below `md`.
 *
 * ── Why this is styling and not a second component ───────────────────────────
 *
 * The obvious way to get bottom sheets on mobile is to render a `Sheet` instead
 * of the popper — and it is a trap. `Select`, `DropdownMenu`, `Popover` and
 * `Command` each carry a pile of behaviour that is the actual product:
 * typeahead, roving focus, `aria-activedescendant`, scroll locking,
 * dismiss-on-outside-press, the selected-value semantics `SelectValue` reads. A
 * parallel mobile implementation re-earns every one of those, and drifts from
 * the desktop one the first time somebody fixes a bug in only one of them.
 *
 * So the primitive stays exactly what it was and only its *presentation*
 * changes. One consequence worth stating plainly: **every existing call site
 * gets bottom sheets without being touched**, and so does every future one.
 *
 * ── The one thing that made this non-obvious ─────────────────────────────────
 *
 * ⚠ **`!important` beats an animation.** Radix positions a popper with an inline
 * `transform: translate(x, y)`, so pinning it to the bottom of the screen means
 * overriding that transform — and per the cascade, an `!important` author
 * declaration outranks a running animation. Do it on the element the sheet is
 * drawn on and `slide-in-from-bottom` silently does nothing: the sheet appears,
 * fully formed, with no motion at all.
 *
 * Hence two elements rather than one. The Radix element becomes an invisible
 * *positioning shell* — pinned, transparent, transform killed — and a plain
 * wrapper inside it is the surface that has the background, the radius and the
 * slide. The wrapper's own transform is untouched, so it animates. It reads the
 * open/closed state off the shell through `group-data-[state=…]`, which is why
 * the shell always carries `group`.
 *
 * On `md` and up the wrapper is `display: contents` — it stops generating a box
 * at all, every class on it goes inert, and the desktop popup is byte-for-byte
 * what it was.
 *
 * The class tokens are in `./mobile-sheet.styles`.
 */

/**
 * The visible sheet. Wraps whatever the popup renders.
 *
 * `md:contents` is what keeps desktop untouched — the element stops producing a
 * box, so the background, the radius and the height cap have nothing to apply
 * to.
 */
export function MobileSheetPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'md:contents',
        'flex max-h-[75dvh] w-full flex-col overflow-hidden',
        'rounded-t-2xl border-t bg-popover text-popover-foreground',
        // Lifted off the page rather than outlined — a bottom sheet reads as a
        // layer above the app, and a plain border reads as part of it.
        'shadow-[0_-10px_40px_-12px_rgb(0_0_0/0.35)]',
        'group-data-[state=open]:animate-in group-data-[state=open]:slide-in-from-bottom-full group-data-[state=open]:duration-300',
        'group-data-[state=closed]:animate-out group-data-[state=closed]:slide-out-to-bottom-full group-data-[state=closed]:duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The grab bar.
 *
 * Purely a signifier — the sheet is dismissed by tapping outside or picking
 * something, both of which Radix already handles. It is here because a panel
 * that slides up from the bottom edge with no handle reads as a stuck menu, and
 * because it gives the thumb somewhere safe to land.
 */
export function MobileSheetHandle({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex shrink-0 justify-center pt-2.5 pb-1 md:hidden', className)}>
      <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

/**
 * The dim behind the sheet.
 *
 * Radix renders no overlay for any of these primitives — a popup hanging off a
 * trigger does not need one. A sheet does: without it the list floats over a
 * fully lit page and stops reading as a modal layer.
 *
 * ── ⚠ Never as a second child of the portal ─────────────────────────────────
 *
 * The obvious placement is as a sibling of the content, inside the same portal
 * element. That crashes the whole route on every open: `Select.Portal`,
 * `Menu.Portal` and `Popover.Portal` each render `<Portal asChild>`, `asChild`
 * is a `Slot`, and a Slot handed two children evaluates
 * `React.Children.only(null)` — a thrown "expected to receive a single React
 * element child" that takes out everything below the nearest error boundary. One
 * extra element in that position is the difference between a working menu and a
 * dead screen.
 *
 * So there are two placements that *are* legal, and which one a primitive wants
 * turns on a single question: does it lock pointer events outside itself?
 * {@link MobileSheetScrim} for the ones that do, {@link MobileSheetPortalScrim}
 * for the ones that don't.
 */

/**
 * The dim, as a child of the Radix content element.
 *
 * For primitives that pass `disableOutsidePointerEvents` — `Select` always, and
 * `DropdownMenu` because its root is modal. Two consequences worth stating:
 *
 *  - **`pointer-events-none`, or dismissal stops working.** A press on a child
 *    of the content is a press *inside* it, and Radix would hold the sheet open.
 *    Transparent to the pointer, the press lands outside instead — which is
 *    already what closes every one of these, so still no handler. It cannot
 *    activate anything on the way through, because those primitives have set
 *    `pointer-events: none` on the body for exactly the length of time the sheet
 *    is open.
 *  - **`-z-10`, so the panel stays on top of it.** The content is positioned and
 *    carries its own `z-50`, so it is a stacking context: a negative index puts
 *    the scrim behind the content's in-flow children (the panel) while keeping
 *    it above the entire page. It cannot escape upward past the sheet.
 *
 * Being inside the content also means it fades in and out with it, which is why
 * it carries no animation of its own.
 */
export function MobileSheetScrim({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 bg-black/40 md:hidden', className)}
    />
  );
}

/**
 * The dim, in a portal of its own beside the content's.
 *
 * For `Popover`, whose root is **non-modal**: nothing is stopping a press from
 * reaching the page, so a scrim that ignores the pointer would dismiss the sheet
 * *and* press whatever field or button happened to be under the thumb. Here the
 * scrim is a real surface that swallows the press, and because it is genuinely
 * outside the content that press is an outside-press — so it still needs no
 * handler of its own.
 *
 * ⚠ Its own `Popover.Portal`, not a second child of the content's — see above.
 * That portal is gated on the open state, so the scrim comes and goes with the
 * sheet.
 *
 * It fades in but not out: `Presence` unmounts a child with no exit animation
 * immediately, and there is no `data-state` on a bare element to hang one off.
 * The panel's slide-down is the motion that reads as "closing" anyway.
 */
export function MobileSheetPortalScrim({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('fixed inset-0 z-40 bg-black/40 animate-in fade-in-0 md:hidden', className)}
    />
  );
}
