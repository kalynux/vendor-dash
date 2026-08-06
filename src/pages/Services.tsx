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
import type { CalendarStatus } from '@/types/services.types';
import { useTranslation, type TranslationKey } from '@/i18n';

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
const OAUTH_REASON_KEYS: Record<string, TranslationKey> = {
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

  const [reloadToken] = useState(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Route to the create wizard when navigated with `state.create` (quick actions).
  useEffect(() => {
    if ((location.state as { create?: boolean } | null)?.create) {
      reactNavigate('/dashboard/service-upload', { replace: true });
    }
  }, [location.state, reactNavigate]);

  // Handle the Google OAuth redirect landing (?calendar=connected|error&reason=…).
  useEffect(() => {
    const calendar = searchParams.get('calendar');
    if (!calendar) return;
    if (calendar === 'connected') {
      toast.success(t('services.calendarPanel.connectedToast'));
    } else if (calendar === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(t(OAUTH_REASON_KEYS[reason] ?? 'services.calendarPanel.connectFailed'));
    }
    setCalendarRefreshKey((k) => k + 1);
    // Strip the params and land on the Calendar tab so a refresh doesn't re-toast.
    const next = new URLSearchParams(searchParams);
    next.delete('calendar');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    reactNavigate('/dashboard/services/calendar', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const showConnectBanner = connected === false && tab !== 'calendar';

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
        />
      </TabsContent>

      <TabsContent value="bookings" className="mt-0">
        <BookingsPanel openBookingId={bookingDeepLinkId} />
      </TabsContent>

      <TabsContent value="calendar" className="mt-0 max-w-2xl">
        <CalendarConnectionPanel
          refreshKey={calendarRefreshKey}
          onStatusChange={(s: CalendarStatus) => setConnected(s.connected)}
        />
      </TabsContent>
    </Tabs>
  );

  // ── Mobile: native pinned header + full-bleed content ─────────────────────────
  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <MobilePageHeader title={t(TAB_TITLE_KEYS[tab])} />
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
