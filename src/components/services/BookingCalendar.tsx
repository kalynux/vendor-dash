import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ApiError } from '@/types/api';
import { fetchBookingCalendar } from '@/services/services.service';
import { BOOKING_STATUS_META, TONE_CLASSES, formatTime } from '@/components/services/service.constants';
import type { BookingCalendarDay } from '@/types/services.types';

interface BookingCalendarProps {
  onOpenBooking: (bookingId: string) => void;
  reloadToken: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function BookingCalendar({ onOpenBooking, reloadToken }: BookingCalendarProps) {
  // Anchor on the first day of the displayed month.
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [days, setDays] = useState<Record<string, BookingCalendarDay['bookings']>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const load = useCallback(async (monthStart: Date) => {
    setLoading(true);
    setError(null);
    try {
      const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
      const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
      const data = await fetchBookingCalendar(start.toISOString(), end.toISOString());
      const map: Record<string, BookingCalendarDay['bookings']> = {};
      for (const d of data) map[d.date] = d.bookings;
      setDays(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const todayKey = ymd(new Date());

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
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { const n = new Date(); setAnchor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load(anchor)}>Try again</Button>
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
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">{w}</div>
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
                        title={`${formatTime(b.startAt)} · ${b.productTitle} · ${b.customerEmail}`}
                        className={cn(
                          'flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight transition hover:opacity-80',
                          TONE_CLASSES[BOOKING_STATUS_META[b.status]?.tone ?? 'neutral'],
                        )}
                      >
                        <span className="font-medium">{formatTime(b.startAt)}</span>
                        <span className="truncate">{b.productTitle}</span>
                      </button>
                    ))}
                    {entries.length > 3 && (
                      <p className="px-1 text-[10px] text-muted-foreground">+{entries.length - 3} more</p>
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
