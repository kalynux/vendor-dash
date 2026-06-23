import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ServicesListPanel } from '@/components/services/ServicesListPanel';
import { BookingsPanel } from '@/components/services/BookingsPanel';
import { CalendarConnectionPanel } from '@/components/services/CalendarConnectionPanel';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUIStore } from '@/store';
import type { CalendarStatus } from '@/types/services.types';

type ServicesTab = 'services' | 'bookings' | 'calendar';

const VALID_TABS: ServicesTab[] = ['services', 'bookings', 'calendar'];

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
  const [searchParams, setSearchParams] = useSearchParams();

  // The active tab is sidebar-controlled via the UI store (mirrors Settings).
  const { servicesTab, setServicesTab } = useUIStore();
  const tab = (VALID_TABS.includes(servicesTab as ServicesTab) ? servicesTab : 'services') as ServicesTab;

  // Seed the store from a `?tab=` deep link once on mount.
  useEffect(() => {
    const tabParam = searchParams.get('tab') as ServicesTab | null;
    if (tabParam && VALID_TABS.includes(tabParam)) setServicesTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setServicesTab('calendar');
    setCalendarRefreshKey((k) => k + 1);
    // Strip the params so a refresh doesn't re-toast.
    const next = new URLSearchParams(searchParams);
    next.delete('calendar');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab switching is driven by the sidebar submenu now; this stays a no-op so the
  // Tabs/connect-banner handlers have something to call.
  function changeTab(_next: string) {}

  const goToCreate = useCallback(() => {
    reactNavigate('/dashboard/service-upload');
  }, [reactNavigate]);

  const goToManage = useCallback((serviceId: string) => {
    reactNavigate(`/dashboard/service-edit/${serviceId}`);
  }, [reactNavigate]);

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
        <BookingsPanel />
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
