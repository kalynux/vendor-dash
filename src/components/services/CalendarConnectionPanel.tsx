import { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck2,
  CalendarX2,
  ShieldCheck,
  TriangleAlert,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation, useFormatters, useApiError } from '@/i18n';
import {
  fetchCalendarStatus,
  disconnectCalendar,
  getCalendarConnectUrl,
  fetchCalendarConnectUrl,
} from '@/services/services.service';
import { isNative, useBearerAuth } from '@/platform/env';
import { openExternal } from '@/platform/browser';
import { appReturnUrl } from '@/platform/shell/appUrl';
import type { CalendarStatus } from '@/types/services.types';

interface CalendarConnectionPanelProps {
  /** Bumping this forces a refetch (e.g. after an OAuth redirect). */
  refreshKey?: number;
  /** Notifies the parent when connection state changes (for gating banners). */
  onStatusChange?: (status: CalendarStatus) => void;
}

export function CalendarConnectionPanel({ refreshKey, onStatusChange }: CalendarConnectionPanelProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCalendarStatus();
      setStatus(data);
      onStatusChange?.(data);
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'services.errors.loadCalendarStatusFailed' }));
    } finally {
      setLoading(false);
    }
  }, [onStatusChange, apiError]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  /**
   * Start the Google OAuth round trip.
   *
   * ⚠ **The consent screen can never load in this app's own WebView.** Google
   * refuses OAuth from an embedded WebView (`disallowed_useragent`), and
   * spoofing the user agent to get around it breaks the OAuth policy — the
   * penalty is the client being disabled for every vendor at once. So there is
   * no "in-app" version of this; there is only which browser gets it.
   *
   * Three transports, two of which are the same code path:
   *
   *  - **Cookie (the web dashboard)** — a plain full-page navigation, exactly as
   *    it has always been. The cookie rides along and the browser follows
   *    Google's redirects itself.
   *  - **Bearer on a device** — `/connect` has no cookie to read, so the URL is
   *    *fetched* and handed to a system browser tab that renders over the app.
   *    The app stays mounted underneath, and the redirect at the end comes back
   *    through `shell/deepLinks.ts`, which closes the tab and routes here.
   *  - **Bearer in a desktop browser** (`VITE_FORCE_MOBILE_AUTH`) — same fetch,
   *    then an ordinary navigation. No `returnTo`: there is no OS to hand a
   *    custom scheme to, so the backend falls back to its configured web
   *    destination, which is where this browser already is.
   */
  const handleConnect = useCallback(async () => {
    if (!useBearerAuth) {
      window.location.href = getCalendarConnectUrl();
      return;
    }

    setConnecting(true);
    try {
      const url = await fetchCalendarConnectUrl(
        isNative ? appReturnUrl('services/calendar') : undefined,
      );
      if (isNative) await openExternal(url);
      else window.location.href = url;
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.calendarPanel.connectFailed' });
    } finally {
      setConnecting(false);
    }
  }, [apiError]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectCalendar();
      toast.success(t('services.calendarPanel.disconnectedToast'));
      setConfirmOpen(false);
      await load();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.disconnectFailed' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-44" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center space-y-3">
        <TriangleAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> {t('common.actions.retry')}
        </Button>
      </div>
    );
  }

  if (!status) return null;

  // ── Not connected ───────────────────────────────────────────────────────────
  if (!status.connected) {
    return (
      <div className="rounded-xl border p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <CalendarX2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">{t('services.calendarPanel.connectTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('services.calendarPanel.connectDescription')}
            </p>
          </div>
        </div>
        <Button onClick={handleConnect} disabled={connecting} className="gap-2">
          {connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarCheck2 className="h-4 w-4" />
          )}
          {t('services.calendarPanel.connect')}
        </Button>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border p-6 space-y-5">
      {status.requiresReauth && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">{t('services.calendarPanel.reauthTitle')}</p>
            <p>{t('services.calendarPanel.reauthDescription')}</p>
            <Button size="sm" onClick={handleConnect} disabled={connecting} className="gap-2">
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('services.calendarPanel.reconnect')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
            <CalendarCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold">{t('services.calendarPanel.connected')}</h3>
            <p className="text-sm text-muted-foreground">{status.email}</p>
            {status.calendarId && (
              <p className="text-xs text-muted-foreground">
                {t('services.calendarPanel.calendarId', { id: status.calendarId })}
              </p>
            )}
            {status.lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                {t('services.calendarPanel.lastSynced', { date: fmt.dateTime(status.lastSyncAt) })}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="gap-2 text-destructive hover:text-destructive"
        >
          <CalendarX2 className="h-4 w-4" /> {t('services.calendarPanel.disconnect')}
        </Button>
      </div>

      {status.permissions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('services.calendarPanel.permissions')}
          </p>
          <ul className="space-y-1.5">
            {status.permissions.map((p) => (
              <li key={p.scope} className="flex items-start gap-2 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span className="text-muted-foreground">{p.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('services.calendarPanel.disconnectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('services.calendarPanel.disconnectDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>
              {t('services.calendarPanel.keepConnected')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDisconnect();
              }}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : t('services.calendarPanel.disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
