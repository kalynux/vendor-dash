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
import { ApiError } from '@/types/api';
import {
  fetchCalendarStatus,
  disconnectCalendar,
  getCalendarConnectUrl,
} from '@/services/services.service';
import { formatDateTime } from '@/components/services/service.constants';
import type { CalendarStatus } from '@/types/services.types';

interface CalendarConnectionPanelProps {
  /** Bumping this forces a refetch (e.g. after an OAuth redirect). */
  refreshKey?: number;
  /** Notifies the parent when connection state changes (for gating banners). */
  onStatusChange?: (status: CalendarStatus) => void;
}

export function CalendarConnectionPanel({ refreshKey, onStatusChange }: CalendarConnectionPanelProps) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCalendarStatus();
      setStatus(data);
      onStatusChange?.(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load calendar status');
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleConnect = () => {
    // Browser navigation (not fetch) so the session cookie rides along and
    // Google's redirects are followed.
    window.location.href = getCalendarConnectUrl();
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectCalendar();
      toast.success('Google Calendar disconnected');
      setConfirmOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to disconnect');
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
          <RefreshCw className="h-4 w-4" /> Retry
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
            <h3 className="font-semibold">Connect Google Calendar</h3>
            <p className="text-sm text-muted-foreground">
              Customers can only book once your calendar is connected — bookings are written as
              events on it, and your existing busy times are blocked from offered slots.
            </p>
          </div>
        </div>
        <Button onClick={handleConnect} className="gap-2">
          <CalendarCheck2 className="h-4 w-4" /> Connect Google Calendar
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
            <p className="font-medium">Reconnection required</p>
            <p>
              Access to your Google Calendar was revoked or expired. Reconnect to keep accepting
              bookings.
            </p>
            <Button size="sm" onClick={handleConnect} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Reconnect
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
            <h3 className="font-semibold">Connected</h3>
            <p className="text-sm text-muted-foreground">{status.email}</p>
            {status.calendarId && (
              <p className="text-xs text-muted-foreground">Calendar: {status.calendarId}</p>
            )}
            {status.lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                Last synced {formatDateTime(status.lastSyncAt)}
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
          <CalendarX2 className="h-4 w-4" /> Disconnect
        </Button>
      </div>

      {status.permissions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Granted permissions
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
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              New bookings will be blocked until you reconnect. Existing bookings are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDisconnect();
              }}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
