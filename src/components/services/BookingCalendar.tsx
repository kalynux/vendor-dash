import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation, useFormatters, useApiError } from '@/i18n';
import { fetchBookingCalendar } from '@/services/services.service';
import { BookingStatusBadge } from '@/components/services/StatusBadges';
import {
  BOOKING_STATUS_META, TONE_CLASSES, DAY_ORDER, DAY_SHORT_KEYS,
} from '@/components/services/service.constants';
import type { BookingCalendarDay, BookingCalendarEntry } from '@/types/services.types';

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
  const isMobile = useIsMobile();

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

  // The day whose bookings are listed in the sheet. One booking skips the list.
  const [dayKey, setDayKey] = useState<string | null>(null);
  const openDay = (key: string, entries: BookingCalendarEntry[]) => {
    if (entries.length === 1) onOpenBooking(entries[0].bookingId);
    else setDayKey(key);
  };
  const dayEntries = useMemo(
    () => (dayKey ? [...(days[dayKey] ?? [])].sort((a, b) => a.startAt.localeCompare(b.startAt)) : []),
    [dayKey, days],
  );
  // Built from the key's own numbers, like the grid cells — a label, not an instant.
  const dayDate = dayKey
    ? new Date(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)))
    : null;

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
          {/* Day cells — the whole square is the target. The chips are far too
              small to aim at on a phone, so tapping anywhere on a day opens its
              one booking, or a list to pick from when there are several. */}
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              const key = ymd(date);
              const inMonth = date.getMonth() === anchor.getMonth();
              const entries = days[key] ?? [];
              const cellClass = cn(
                'flex min-h-[92px] flex-col items-stretch border-b border-r p-1.5 text-left last:border-r-0 [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-muted/20 text-muted-foreground',
              );
              const content = (
                <>
                  <span
                    className={cn(
                      'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      key === todayKey && 'bg-primary text-primary-foreground font-semibold',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <span className="space-y-1">
                    {entries.slice(0, 3).map((b) => (
                      <span
                        key={b.bookingId}
                        className={cn(
                          'flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight',
                          TONE_CLASSES[BOOKING_STATUS_META[b.status]?.tone ?? 'neutral'],
                        )}
                      >
                        <span className="font-medium">{fmt.time(b.startAt)}</span>
                        {/* A phone column is ~50px: the title only ever showed as "H". */}
                        <span className="hidden truncate md:inline">{b.productTitle}</span>
                      </span>
                    ))}
                    {entries.length > 3 && (
                      <span className="block px-1 text-[10px] text-muted-foreground">
                        {t('services.calendarView.more', { count: entries.length - 3 })}
                      </span>
                    )}
                  </span>
                </>
              );
              if (entries.length === 0) {
                return <div key={i} className={cellClass}>{content}</div>;
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => openDay(key, entries)}
                  aria-label={t('services.calendarView.dayLabel', {
                    date: fmt.date(date, 'long'),
                    count: entries.length,
                  })}
                  className={cn(cellClass, 'transition-colors hover:bg-muted/40')}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Sheet open={!!dayKey} onOpenChange={(o) => { if (!o) setDayKey(null); }}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'flex flex-col p-0',
            isMobile ? 'max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]' : 'w-full sm:max-w-md',
          )}
        >
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{dayDate ? fmt.date(dayDate, 'long') : ''}</SheetTitle>
            <SheetDescription>
              {t('services.calendarView.dayCount', { count: dayEntries.length })}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {dayEntries.map((b) => (
              <button
                key={b.bookingId}
                type="button"
                onClick={() => { setDayKey(null); onOpenBooking(b.bookingId); }}
                className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/30"
              >
                <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                  {fmt.time(b.startAt)} – {fmt.time(b.endAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{b.productTitle}</span>
                  <span className="block truncate text-xs text-muted-foreground">{b.customerEmail}</span>
                </span>
                <BookingStatusBadge status={b.status} />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
