import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters, useApiError } from '@/i18n';
import { fetchBookingCalendar } from '@/services/services.service';
import {
  BOOKING_STATUS_META, TONE_CLASSES, DAY_ORDER, DAY_SHORT_KEYS,
} from '@/components/services/service.constants';
import type { BookingCalendarDay } from '@/types/services.types';

interface BookingCalendarProps {
  onOpenBooking: (bookingId: string) => void;
  reloadToken: number;
}

/**
 * The calendar-day label for a grid cell.
 *
 * Safe with local getters *because the cell is not an instant*: it was built with
 * `new Date(y, m, d)` from local components, so these read back the same numbers
 * that went in. This is the square's own label, not a conversion.
 */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Today's wall-clock day in `timeZone`, as `YYYY-MM-DD`.
 *
 * ⚠ This one genuinely needs the zone. The server's `date` keys are wall-clock
 * days in the VENDOR's timezone, and a vendor abroad — or simply a browser set to
 * another zone — has a different "today" from the calendar they are looking at,
 * so the highlighted square would be the wrong one for hours either side of
 * midnight.
 *
 * `en-CA` is passed as a literal because it formats as `YYYY-MM-DD`; never pass
 * `undefined` as the locale (a standing rule here), and never the display locale
 * either — this is a map key, not something a person reads.
 */
function todayIn(timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone ?? undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // An unknown IANA zone throws rather than falling back. The browser's own
    // zone is the same answer this component gave before `meta.timezone` existed.
    return ymd(new Date());
  }
}

export function BookingCalendar({ onOpenBooking, reloadToken }: BookingCalendarProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();

  // Anchor on the first day of the displayed month.
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [days, setDays] = useState<Record<string, BookingCalendarDay['bookings']>>({});
  // The zone the server grouped its `date` keys in. `null` until the first load
  // lands, and on a backend from before 2026-09-09 that sends no `meta`.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = fmt.date(anchor, 'monthYear');

  const load = useCallback(async (monthStart: Date) => {
    setLoading(true);
    setError(null);
    try {
      // ⚠ Widened by a day at each end. The bounds are instants (`toISOString`
      // converts local midnight to UTC) while the response groups by the
      // VENDOR's wall-clock day, so an exact month sent from a browser in a
      // different zone clips the first or last day of that month. Every offset
      // is under 24h, so one day of slack covers all of them, and the extra days
      // are simply never looked up. Far more robust than doing the arithmetic.
      const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0);
      const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1, 23, 59, 59);
      const { days: data, timezone: tz } = await fetchBookingCalendar(
        start.toISOString(),
        end.toISOString(),
      );
      const map: Record<string, BookingCalendarDay['bookings']> = {};
      for (const d of data) map[d.date] = d.bookings;
      setDays(map);
      setTimezone(tz);
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'services.errors.loadCalendarFailed' }));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    load(anchor);
  }, [anchor, load, reloadToken]);

  // Build the 6-week grid covering the month.
  const cells = useMemo(() => {
    const firstWeekday = anchor.getDay(); // 0=Sun
    const gridStart = new Date(anchor);
    gridStart.setDate(anchor.getDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return date;
    });
  }, [anchor]);

  // Which square to highlight — the vendor's today, not the browser's.
  const todayKey = todayIn(timezone);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
            aria-label={t('services.calendarView.previousMonth')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { const n = new Date(); setAnchor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
          >
            {t('services.calendarView.today')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
            aria-label={t('services.calendarView.nextMonth')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load(anchor)}>{t('common.actions.retry')}</Button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg border">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {DAY_ORDER.map((day) => (
              <div key={day} className="py-2">{t(DAY_SHORT_KEYS[day])}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              const key = ymd(date);
              const inMonth = date.getMonth() === anchor.getMonth();
              const entries = days[key] ?? [];
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[92px] border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                    !inMonth && 'bg-muted/20 text-muted-foreground',
                  )}
                >
                  <div
                    className={cn(
                      'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      key === todayKey && 'bg-primary text-primary-foreground font-semibold',
                    )}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {entries.slice(0, 3).map((b) => (
                      <button
                        key={b.bookingId}
                        type="button"
                        onClick={() => onOpenBooking(b.bookingId)}
                        title={`${fmt.time(b.startAt)} · ${b.productTitle} · ${b.customerEmail}`}
                        className={cn(
                          'flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight transition hover:opacity-80',
                          TONE_CLASSES[BOOKING_STATUS_META[b.status]?.tone ?? 'neutral'],
                        )}
                      >
                        <span className="font-medium">{fmt.time(b.startAt)}</span>
                        <span className="truncate">{b.productTitle}</span>
                      </button>
                    ))}
                    {entries.length > 3 && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        {t('services.calendarView.more', { count: entries.length - 3 })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
