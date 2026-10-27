import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, CalendarClock, TriangleAlert, Timer } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ApiError } from '@/types/api';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import {
  fetchAvailability, lockSlot, unlockSlot, rescheduleBooking, holdBookingSlots,
} from '@/services/services.service';
import { formatDuration } from '@/components/services/service.constants';
import { responsiveSheetProps } from '@/components/ui/responsive-sheet';
import type { AvailabilitySlot, Booking } from '@/types/services.types';

interface RescheduleSheetProps {
  bookingId: string | null;
  productId: string | null;
  /** The appointment being moved — its length decides how many slots a new time takes. */
  bookingStartAt: string | null;
  bookingEndAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The booking as the server returned it: same time, `rescheduleProposal` open. */
  onProposed: (booking: Booking) => void;
}

const LOOKAHEAD_DAYS = 21;

/** A start time the vendor can pick: one slot, or the run of consecutive slots it begins. */
interface MoveOption {
  key: string;
  slotIds: string[];
  startAt: string;
  endAt: string;
}

// `details.reason` on `400 BOOKING_INVALID_SLOT_ID` — stable, unlike the message.
const INVALID_SLOT_REASON_KEYS: Record<string, TranslationKey> = {
  not_contiguous: 'services.reschedule.errors.notContiguous',
  length_changed: 'services.reschedule.errors.lengthChanged',
  slot_count: 'services.reschedule.errors.slotCount',
  not_future: 'services.reschedule.errors.notFuture',
  inverted: 'services.reschedule.errors.inverted',
};

/**
 * Propose a new time for an appointment. Since 2026-10-26 the server never
 * moves it here: the customer accepts or declines, and until then the booking
 * keeps its time.
 *
 * An appointment can span several consecutive slots (2 × 1 h). `GET
 * /availability` only returns single slots, so the sheet offers each start time
 * that is followed by enough free slots, and holds and sends the whole run.
 */
export function RescheduleSheet({
  bookingId, productId, bookingStartAt, bookingEndAt, open, onOpenChange, onProposed,
}: RescheduleSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-lg');

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MoveOption | null>(null);
  const [locking, setLocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // What is held right now, so cancel/close can give it back.
  const heldLock = useRef<{ slotIds: string[] } | null>(null);

  const bookingMinutes = bookingStartAt && bookingEndAt
    ? Math.round((Date.parse(bookingEndAt) - Date.parse(bookingStartAt)) / 60000)
    : 0;

  const releaseLock = useCallback(async () => {
    if (productId && heldLock.current) {
      const { slotIds } = heldLock.current;
      heldLock.current = null;
      setLockExpiresAt(null);
      setSecondsLeft(null);
      // Each slot of a run is held under its own id; the storefront unlock
      // releases only holds this shop took. Best-effort — holds expire anyway.
      await Promise.all(slotIds.map((id) => unlockSlot(productId, id).catch(() => undefined)));
    }
  }, [productId]);

  const loadSlots = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + LOOKAHEAD_DAYS);
      const data = await fetchAvailability(productId, from.toISOString(), to.toISOString());
      setSlots(data.filter((s) => s.available !== false));
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'services.errors.loadSlotsFailed' }));
    } finally {
      setLoading(false);
    }
  }, [productId, apiError]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      heldLock.current = null;
      setLockExpiresAt(null);
      setSecondsLeft(null);
      loadSlots();
    } else {
      releaseLock();
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadSlots]);

  // Give the hold back if the sheet unmounts while holding one.
  useEffect(() => () => { releaseLock(); }, [releaseLock]);

  // Countdown for the 15-minute hold.
  useEffect(() => {
    if (!lockExpiresAt) return;
    const tick = () => {
      const ms = new Date(lockExpiresAt).getTime() - Date.now();
      const s = Math.max(0, Math.floor(ms / 1000));
      setSecondsLeft(s);
      if (s <= 0) {
        heldLock.current = null;
        setSelected(null);
        setLockExpiresAt(null);
        toast.warning(t('services.reschedule.lockExpired'));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockExpiresAt]);

  /**
   * How many slots the appointment covers: its length ÷ one slot's length
   * (every slot is one `durationMinutes` long). Not a whole number → treat it
   * as one slot and let the server say the length doesn't match.
   */
  const slotsNeeded = useMemo(() => {
    const first = slots[0];
    if (!first || !bookingMinutes) return 1;
    const slotMinutes = Math.round((Date.parse(first.endAt) - Date.parse(first.startAt)) / 60000);
    if (slotMinutes <= 0) return 1;
    const n = bookingMinutes / slotMinutes;
    return Number.isInteger(n) && n >= 1 ? n : 1;
  }, [slots, bookingMinutes]);

  const options = useMemo(() => buildOptions(slots, slotsNeeded), [slots, slotsNeeded]);
  const byDay = useMemo(() => groupByDay(options), [options]);

  /** The sentence for a refused hold or move — branching on `details.reason`, never the message. */
  function moveErrorMessage(err: unknown, fallbackKey: TranslationKey): string {
    if (err instanceof ApiError) {
      const details = err.detailsObject ?? {};
      if (err.code === 'BOOKING_INVALID_SLOT_ID' && typeof details.reason === 'string') {
        const key = INVALID_SLOT_REASON_KEYS[details.reason];
        if (key) return t(key, { duration: formatDuration(bookingMinutes, t) });
      }
      if (err.code === 'BOOKING_SLOT_LOCKED' && typeof details.slotId === 'string') {
        const startMs = Number(details.slotId.split('_')[1]);
        if (Number.isFinite(startMs) && startMs > 0) {
          return t('services.reschedule.errors.slotLockedAt', { time: fmt.time(new Date(startMs)) });
        }
      }
    }
    return apiError.resolve(err, { fallbackKey });
  }

  async function handleSelect(option: MoveOption) {
    if (!productId || !bookingId || locking) return;
    await releaseLock();
    setSelected(option);
    setLocking(true);
    try {
      // One slot keeps the storefront hold it always used. A run needs the
      // shop's hold, which takes the whole run in one call and leaves nothing
      // held if any slot of it is taken.
      const expiresAt = option.slotIds.length === 1
        ? (await lockSlot(productId, option.slotIds[0])).expiresAt
        : (await holdBookingSlots(bookingId, option.slotIds)).expiresAt;
      heldLock.current = { slotIds: option.slotIds };
      setLockExpiresAt(expiresAt);
    } catch (err) {
      setSelected(null);
      toast.error(moveErrorMessage(err, 'services.reschedule.lockFailed'));
      if (err instanceof ApiError && err.code === 'BOOKING_SLOT_LOCKED') loadSlots();
    } finally {
      setLocking(false);
    }
  }

  async function handleConfirm() {
    if (!bookingId || !productId || !selected) return;
    setSubmitting(true);
    try {
      // The same ids, in the same order, as were held.
      const updated = await rescheduleBooking(bookingId, selected.slotIds);
      heldLock.current = null; // the proposal now holds the time
      toast.success(t('services.toast.rescheduleProposed'));
      onProposed(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(moveErrorMessage(err, 'services.errors.rescheduleFailed'));
      if (err instanceof ApiError && err.code === 'BOOKING_SLOT_NOT_LOCKED') {
        setSelected(null);
        heldLock.current = null;
        setLockExpiresAt(null);
        loadSlots();
      }
      if (err instanceof ApiError && err.code === 'BOOKING_PROPOSAL_PENDING') {
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const countdownLabel =
    secondsLeft != null
      ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0 flex flex-col', sheet.className)}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{t('services.reschedule.title')}</SheetTitle>
          <SheetDescription>{t('services.reschedule.description')}</SheetDescription>
        </SheetHeader>

        <SheetBody className="p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <TriangleAlert className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={loadSlots}>{t('common.actions.retry')}</Button>
            </div>
          ) : options.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {slotsNeeded > 1
                  ? t('services.reschedule.emptyLong', {
                    days: LOOKAHEAD_DAYS,
                    duration: formatDuration(bookingMinutes, t),
                  })
                  : t('services.reschedule.empty', { days: LOOKAHEAD_DAYS })}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {slotsNeeded > 1 && (
                <p className="text-sm text-muted-foreground">
                  {t('services.reschedule.longHint', { duration: formatDuration(bookingMinutes, t) })}
                </p>
              )}
              {byDay.map((group) => (
                <div key={group.date} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {fmt.date(group.date)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const isSel = selected?.key === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          disabled={locking}
                          onClick={() => handleSelect(option)}
                          className={cn(
                            'min-h-11 rounded-lg border px-3 py-2 text-sm tabular-nums transition-colors disabled:opacity-60',
                            isSel
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'hover:bg-accent',
                          )}
                        >
                          {isSel && locking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : slotsNeeded > 1 ? (
                            // A run shows where it ends too — that's what "2 h" means here.
                            t('services.proposal.timeRange', { start: fmt.time(option.startAt), end: fmt.time(option.endAt) })
                          ) : (
                            fmt.time(option.startAt)
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetBody>

        <SheetFooter className="flex-col gap-2 border-t sm:flex-row sm:items-center sm:justify-between">
          {selected && lockExpiresAt && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              {t('services.reschedule.heldFor', { time: countdownLabel ?? '' })}
            </span>
          )}
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="flex-1 sm:flex-none">
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selected || !lockExpiresAt || locking || submitting}
              className="flex-1 sm:flex-none"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('services.reschedule.confirm')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Every start time the vendor can pick. With one slot needed, that is every
 * free slot. With several, a slot only counts as a start if the next ones are
 * free and follow it with no gap — each starting exactly where the last ends.
 */
function buildOptions(slots: AvailabilitySlot[], needed: number): MoveOption[] {
  const sorted = [...slots].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const out: MoveOption[] = [];
  for (let i = 0; i + needed <= sorted.length; i += 1) {
    const run = sorted.slice(i, i + needed);
    const contiguous = run.every((s, j) => j === 0 || Date.parse(s.startAt) === Date.parse(run[j - 1].endAt));
    if (!contiguous) continue;
    out.push({
      key: run.map((s) => s.id).join('|'),
      slotIds: run.map((s) => s.id),
      startAt: run[0].startAt,
      endAt: run[run.length - 1].endAt,
    });
  }
  return out;
}

function groupByDay(options: MoveOption[]): { date: string; options: MoveOption[] }[] {
  const map = new Map<string, MoveOption[]>();
  for (const o of options) {
    const key = o.startAt.slice(0, 10); // YYYY-MM-DD
    const arr = map.get(key) ?? [];
    arr.push(o);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([date, dayOptions]) => ({ date, options: dayOptions }));
}
