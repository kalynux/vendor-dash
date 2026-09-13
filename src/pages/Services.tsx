import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ServicesListPanel } from '@/components/services/ServicesListPanel';
import { BookingsPanel } from '@/components/services/BookingsPanel';
import { CalendarConnectionPanel } from '@/components/services/CalendarConnectionPanel';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { fetchCalendarStatus } from '@/services/services.service';
import type { CalendarStatus } from '@/types/services.types';
import { useTranslation, type TranslationKey } from '@/i18n';
import { closeExternal } from '@/platform/browser';

type ServicesTab = 'services' | 'bookings' | 'calendar';

// Bookings sub-tabs are real routes. The index route is the services list; the
// other two get their own URL segment.
const PARAM_TO_TAB: Record<string, ServicesTab> = {
  appointments: 'bookings',
  calendar: 'calendar',
};
const TAB_TO_PATH: Record<ServicesTab, string> = {
  services: '/dashboard/services',
  bookings: '/dashboard/services/appointments',
  calendar: '/dashboard/services/calendar',
};

/**
 * The three, as routes, in strip order — what a sideways swipe walks.
 * Spelled out rather than read off `TAB_TO_PATH`, whose key order is an
 * implementation detail that a reorder would silently change.
 */
const TAB_RING = [
  TAB_TO_PATH.services,
  TAB_TO_PATH.bookings,
  TAB_TO_PATH.calendar,
];

// Header title per sidebar sub-tab (mirrors the Bookings submenu labels).
const TAB_TITLE_KEYS: Record<ServicesTab, TranslationKey> = {
  services: 'services.tabs.services',
  bookings: 'services.tabs.appointments',
  calendar: 'services.tabs.calendar',
};

const TAB_SUBTITLE_KEYS: Record<ServicesTab, TranslationKey> = {
  services: 'services.tabSubtitles.services',
  bookings: 'services.tabSubtitles.appointments',
  calendar: 'services.tabSubtitles.calendar',
};

// Friendly messages for the OAuth landing `reason` codes (calendar.md).
// `state_mismatch` is no longer emitted — the callback stopped cross-checking a
// cookie session against the signed state — but the mapping is kept so an older
// deployment still produces a sentence rather than a code.
const OAUTH_REASON_KEYS: Record<string, TranslationKey> = {
  access_denied: 'services.calendarPanel.oauth.access_denied',
  missing_code: 'services.calendarPanel.oauth.missing_code',
  missing_state: 'services.calendarPanel.oauth.missing_state',
  state_mismatch: 'services.calendarPanel.oauth.state_mismatch',
  invalid_state: 'services.calendarPanel.oauth.invalid_state',
  connection_failed: 'services.calendarPanel.oauth.connection_failed',
};

export function Services() {
  const { t } = useTranslation();
  const location = useLocation();
  const reactNavigate = useNavigate();
  const isMobile = useIsMobile();
  const { tab: tabParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Before the redirect below — a hook cannot sit behind an early return.
  useRouteSwipe(TAB_RING);

  const [reloadToken] = useState(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);

  /**
   * The calendar connection, read once for the whole page.
   *
   * It used to arrive only through `CalendarConnectionPanel`'s `onStatusChange`,
   * but that panel sits inside `TabsContent value="calendar"` and Radix unmounts
   * inactive tabs — so on the Services tab it had never mounted, the status was
   * still `null`, and both readers below were dead on a first visit. Fetching it
   * here makes it tab-independent; the panel still pushes its own result back so
   * a connect/disconnect updates the banner and badges without a reload.
   */
  useEffect(() => {
    let cancelled = false;
    fetchCalendarStatus()
      .then((s) => { if (!cancelled) setCalendar(s); })
      .catch(() => { if (!cancelled) setCalendar(null); });
    return () => { cancelled = true; };
  }, [calendarRefreshKey]);

  // Route to the create wizard when navigated with `state.create` (quick actions).
  useEffect(() => {
    if ((location.state as { create?: boolean } | null)?.create) {
      reactNavigate('/dashboard/service-upload', { replace: true });
    }
  }, [location.state, reactNavigate]);

  // Handle the Google OAuth redirect landing (?calendar=connected|error&reason=…).
  //
  // Keyed on the param rather than run once on mount. On the web this page is
  // freshly mounted by the redirect, so the two were equivalent — but a native
  // deep-link return navigates an ALREADY-MOUNTED Services page (the vendor
  // started the flow from this very tab), and a mount-only effect would never
  // see it: no toast, no refetch, and a calendar that looks unconnected until
  // the page is reloaded. Stripping the params below drives the value back to
  // null, so the re-run bails on the guard instead of looping.
  const calendarResult = searchParams.get('calendar');
  useEffect(() => {
    if (!calendarResult) return;
    if (calendarResult === 'connected') {
      toast.success(t('services.calendarPanel.connectedToast'));
    } else if (calendarResult === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(t(OAUTH_REASON_KEYS[reason] ?? 'services.calendarPanel.connectFailed'));
    }
    setCalendarRefreshKey((k) => k + 1);
    // Dismiss the system browser tab the OAuth flow ran in. On native this route
    // was reached by a `wivendor://` redirect out of that tab, which is still on
    // screen behind the app — left open, pressing back returns the vendor to a
    // consent screen they have already consented to. A no-op on the web and when
    // nothing is open (CAPACITOR-PLAN.md → P3.5).
    void closeExternal();
    // Strip the params and land on the Calendar tab so a refresh doesn't re-toast.
    const next = new URLSearchParams(searchParams);
    next.delete('calendar');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    reactNavigate('/dashboard/services/calendar', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarResult]);

  // Deep-link from a notification (`/dashboard/services/appointments?view=<id>`):
  // hand the booking id to BookingsPanel to auto-open, then strip the param so a
  // refresh/back doesn't reopen it.
  const bookingDeepLinkId = searchParams.get('view');
  useEffect(() => {
    if (!bookingDeepLinkId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingDeepLinkId]);

  const changeTab = useCallback(
    (next: string) => {
      reactNavigate(TAB_TO_PATH[next as ServicesTab] ?? '/dashboard/services');
    },
    [reactNavigate],
  );

  const goToCreate = useCallback(() => {
    reactNavigate('/dashboard/service-upload');
  }, [reactNavigate]);

  const goToManage = useCallback((serviceId: string) => {
    reactNavigate(`/dashboard/service-edit/${serviceId}`);
  }, [reactNavigate]);

  // Resolve the active tab from the URL segment. Unknown segments redirect home.
  const tab: ServicesTab | null = tabParam
    ? PARAM_TO_TAB[tabParam] ?? null
    : 'services';

  if (tab === null) {
    return <Navigate to="/dashboard/services" replace />;
  }

  const showConnectBanner = calendar?.connected === false && tab !== 'calendar';

  const connectBanner = showConnectBanner && (
    <button
      type="button"
      onClick={() => changeTab('calendar')}
      className="flex w-full items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <TriangleAlert className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1">{t('services.calendarPanel.banner')}</span>
      <span className="font-medium underline">{t('services.calendarPanel.connectShort')}</span>
    </button>
  );

  const tabsNode = (
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsContent value="services" className="mt-0">
        <ServicesListPanel
          onOpenDetail={goToManage}
          onCreate={goToCreate}
          reloadToken={reloadToken}
          calendarDesynced={calendar?.requiresReauth ?? false}
        />
      </TabsContent>

      <TabsContent value="bookings" className="mt-0">
        <BookingsPanel openBookingId={bookingDeepLinkId} />
      </TabsContent>

      <TabsContent value="calendar" className="mt-0 max-w-2xl">
        <CalendarConnectionPanel
          refreshKey={calendarRefreshKey}
          onStatusChange={(s: CalendarStatus) => setCalendar(s)}
        />
      </TabsContent>
    </Tabs>
  );

  // ── Mobile: native pinned header + full-bleed content ─────────────────────────
  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <MobilePageHeader
          title={t(TAB_TITLE_KEYS[tab])}
          description={t(TAB_SUBTITLE_KEYS[tab])}
        />
        <div className="space-y-4 px-4 pt-4 pb-24">
          {connectBanner}
          {tabsNode}
        </div>
      </div>
    );
  }

  // ── Desktop ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header — "Bookings › <tab>", so the page names the surface you opened. */}
      <SubPageHeader
        parent={t('nav.items.bookings')}
        current={t(TAB_TITLE_KEYS[tab])}
        description={t(TAB_SUBTITLE_KEYS[tab])}
        icon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
        }
      />

      {connectBanner}

      {tabsNode}
    </div>
  );
}
