import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Resolve the viewport synchronously on the FIRST render (not after mount).
// Deferring it made every page render its desktop tree for one frame and then
// swap to the mobile tree once the effect ran — a visible flash where content
// showed up, blinked out, then reappeared. This is a client-only SPA, so
// `window` is always available; there's no SSR reason to defer.
function getIsMobile(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(getIsMobile())
    mql.addEventListener("change", onChange)
    // Re-sync in case the width changed between first render and mount.
    setIsMobile(getIsMobile())
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
