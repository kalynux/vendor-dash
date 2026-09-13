import { Navigate, useLocation } from 'react-router-dom';
import { routeFromNotificationPath } from '@/lib/notifications.utils';

/**
 * The catch-all, with one attempt at rescue before it gives up.
 *
 * Notification buttons on email, WhatsApp and Telegram can only carry a URL, so
 * the backend sends `{VENDOR_APP_URL}/{path}` where `path` is one of the eight
 * labels in api-doc/notifications/deep-links.md — with no `/dashboard` prefix,
 * because the backend does not know this app's route tree and deliberately never
 * will. Redirecting those straight to `/dashboard` drops the recipient on the
 * home screen with no explanation and no id: not a 404, a silent wrong page.
 *
 * So try the same vocabulary the in-app inbox already speaks, one layer up. One
 * resolver, one vocabulary — the alternative is two that drift.
 *
 * Mounted at BOTH catch-alls on purpose: the top-level one catches
 * `/orders/665f…` (an emailed App Link) and the shell's catches
 * `/dashboard/orders/665f…` (what the custom scheme produces).
 *
 * Lives in its own module rather than in App.tsx because the shell that holds
 * the second catch-all is now loaded lazily — see `routes/lazy.ts`. Keeping it
 * here means the shell chunk does not have to reach back into the entry for it.
 */
export function DeepLinkFallback({ stripDashboard = false }: { stripDashboard?: boolean }) {
  const { pathname, search } = useLocation();
  const candidate = stripDashboard ? pathname.replace(/^\/dashboard\/?/, '') : pathname;
  const resolved = routeFromNotificationPath(candidate);
  // An unresolved path is "no destination", never an error — that is what lets
  // the backend add a label before this build ships a case for it.
  if (!resolved) return <Navigate to="/dashboard" replace />;
  // A resolver-built `?view=` wins; anything else the link carried is preserved.
  const to = resolved.includes('?') ? resolved : `${resolved}${search}`;
  return <Navigate to={to} replace />;
}
