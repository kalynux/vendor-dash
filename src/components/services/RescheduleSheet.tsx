import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, CalendarClock, TriangleAlert, Timer } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ApiError } from '@/types/api';
import { useTranslation, useFormatters, useApiError } from '@/i18n';
import {
  fetchAvailability, lockSlot, unlockSlot, rescheduleBooking,
} from '@/services/services.service';
import { responsiveSheetProps } from '@/components/services/service.constants';
import type { AvailabilitySlot } from '@/types/services.types';

interface RescheduleSheetProps {
  bookingId: string | null;
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
}

const LOOKAHEAD_DAYS = 21;

export function RescheduleSheet({
  bookingId, productId, open, onOpenChange, onRescheduled,
}: RescheduleSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-lg');

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [locking, setLocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Track the currently-held lock so we can release it on cancel/close.
  const heldLock = useRef<{ slotId: string } | null>(null);

  const releaseLock = useCallback(async () => {
    if (productId && heldLock.current) {
      const slotId = heldLock.current.slotId;
      heldLock.current = null;
      setLockExpiresAt(null);
      setSecondsLeft(null);
      try {
        await unlockSlot(productId, slotId);
      } catch {
        // best-effort; the lock will also expire on its own
      }
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
      const data = await fetchAvailability(
        productId,
        from.toISOString(),
        to.toISOString(),
      );
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
      // Closing — release any held lock.
      releaseLock();
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadSlots]);

  // Release the lock if the component unmounts while holding one.
  useEffect(() => () => { releaseLock(); }, [releaseLock]);

  // Countdown timer for the 15-minute lock.
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

  async function handleSelect(slot: AvailabilitySlot) {
    if (!productId || locking) return;
    // Release a previous hold first.
    await releaseLock();
    setSelected(slot);
    setLocking(true);
    try {
      const lock = await lockSlot(productId, slot.id);
      heldLock.current = { slotId: slot.id };
      setLockExpiresAt(lock.expiresAt);
    } catch (err) {
      setSelected(null);
      apiError.toast(err, { fallbackKey: 'services.reschedule.lockFailed' });
    } finally {
      setLocking(false);
    }
  }

  async function handleConfirm() {
    if (!bookingId || !productId || !selected) return;
    setSubmitting(true);
    try {
      await rescheduleBooking(bookingId, selected.id);
      heldLock.current = null; // consumed by the reschedule
      toast.success(t('services.toast.bookingRescheduled'));
      onRescheduled();
      onOpenChange(false);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.rescheduleFailed' });
      // If the lock expired, prompt re-selection.
      if (err instanceof ApiError && err.code === 'BOOKING_SLOT_NOT_LOCKED') {
        setSelected(null);
        heldLock.current = null;
        setLockExpiresAt(null);
        loadSlots();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Group slots by calendar day for display.
  const byDay = groupByDay(slots);

  const countdownLabel =
    secondsLeft != null
      ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0 flex flex-col', sheet.className)}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{t('services.reschedule.title')}</SheetTitle>
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
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('services.reschedule.empty', { days: LOOKAHEAD_DAYS })}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {byDay.map((group) => (
                <div key={group.date} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {fmt.date(group.date)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot) => {
                      const isSel = selected?.id === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={locking}
                          onClick={() => handleSelect(slot)}
                          className={cn(
                            'rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-60',
                            isSel
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'hover:bg-accent',
                          )}
                        >
                          {isSel && locking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            fmt.time(slot.startAt)
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

function groupByDay(slots: AvailabilitySlot[]): { date: string; slots: AvailabilitySlot[] }[] {
  const map = new Map<string, AvailabilitySlot[]>();
  for (const s of [...slots].sort((a, b) => a.startAt.localeCompare(b.startAt))) {
    const key = s.startAt.slice(0, 10); // YYYY-MM-DD
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([date, daySlots]) => ({ date, slots: daySlots }));
}
