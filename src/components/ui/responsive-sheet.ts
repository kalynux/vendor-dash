/**
 * Shared responsive-Sheet props: a bottom sheet on mobile, a right-side panel on
 * desktop. Previously duplicated verbatim in the customers, services and tickets
 * constants modules; keep this the single copy.
 *
 * The mobile branch carries the bottom safe-area inset so a sheet's pinned
 * footer clears the Android gesture bar / iOS home indicator. `env()` resolves
 * to 0 outside notched and standalone contexts, so this is inert on the web and
 * on desktop.
 *
 * Callers merge this className LAST — `cn('p-0', sheet.className)` — because
 * `cn` is tailwind-merge: a leading `p-0` would otherwise strip the padding-bottom.
 */
export function responsiveSheetProps(
  isMobile: boolean,
  desktopWidth = 'sm:max-w-xl',
): { side: 'bottom' | 'right'; className: string } {
  return isMobile
    ? { side: 'bottom', className: 'h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]' }
    : { side: 'right', className: `w-full ${desktopWidth}` };
}
