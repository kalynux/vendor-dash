import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ServicesListPanel } from '@/components/services/ServicesListPanel';
import { BookingsPanel } from '@/components/services/BookingsPanel';
import { CalendarConnectionPanel } from '@/components/services/CalendarConnectionPanel';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CalendarStatus } from '@/types/services.types';

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

// Mobile header title per sidebar sub-tab (mirrors the Bookings submenu labels).
const TAB_TITLES: Record<ServicesTab, string> = {
  services: 'Services',
  bookings: 'Appointments',
  calendar: 'Calendar',
};

// Friendly messages for the OAuth landing `reason` codes (calendar.md).
const OAUTH_REASON_MESSAGES: Record<string, string> = {
  missing_code: 'Google did not return an authorization code. Please try again.',
  missing_state: 'The connection request was missing its security token. Please try again.',
  state_mismatch: 'The connection could not be verified. Please try connecting again.',
  invalid_state: 'The connection link expired. Please try connecting again.',
  connection_failed: 'We could not complete the connection with Google. Please try again.',
};

export function Services() {
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
      toast.success('Google Calendar connected');
    } else if (calendar === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(OAUTH_REASON_MESSAGES[reason] ?? 'Could not connect Google Calendar.');
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
      <span className="flex-1">
        Connect your Google Calendar so customers can book. Setup works without it, but bookings
        need a connected calendar.
      </span>
      <span className="font-medium underline">Connect</span>
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
        <MobilePageHeader title={TAB_TITLES[tab]} />
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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <CalendarClock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Sell bookable services synced to your Google Calendar.
          </p>
        </div>
      </div>

      {connectBanner}

      {tabsNode}
    </div>
  );
}
