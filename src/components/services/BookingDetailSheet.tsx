import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, XCircle, CalendarClock, User, Banknote, CalendarSync,
  CheckCircle2, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ApiError } from '@/types/api';
import {
  fetchBookingById, updateBookingStatus, markBookingPaid, cancelBooking, BOOKING_ERROR_MAP,
} from '@/services/services.service';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/services/StatusBadges';
import { RescheduleSheet } from '@/components/services/RescheduleSheet';
import { CompleteBookingDialog } from '@/components/services/CompleteBookingDialog';
import {
  responsiveSheetProps, formatDateTime, formatTime, formatMinor,
  BOOKING_TRANSITIONS, CANCEL_REASON_MAX, type BookingTransition,
} from '@/components/services/service.constants';
import type { Booking } from '@/types/services.types';

interface BookingDetailSheetProps {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

function refId(ref: { _id: string } | string | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref._id;
}

function productTitle(b: Booking): string {
  return typeof b.productId === 'object' ? b.productId.title : 'Service';
}

function customerEmail(b: Booking): string {
  return typeof b.userId === 'object' ? b.userId.login_email ?? '—' : '—';
}

export function BookingDetailSheet({ bookingId, open, onOpenChange, onChanged }: BookingDetailSheetProps) {
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-lg');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<BookingTransition | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setBooking(await fetchBookingById(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && bookingId) load(bookingId);
    if (!open) { setBooking(null); setError(null); setCancelReason(''); }
  }, [open, bookingId, load]);

  async function applyStatus(target: BookingTransition['target']) {
    if (!booking) return;
    setBusy(true);
    try {
      const updated = await updateBookingStatus(booking._id, target);
      setBooking(updated);
      toast.success('Booking updated');
      setPendingStatus(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? BOOKING_ERROR_MAP[err.code] ?? err.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!booking) return;
    setBusy(true);
    try {
      const updated = await cancelBooking(booking._id, cancelReason.trim() || undefined);
      setBooking(updated);
      toast.success('Booking cancelled');
      setCancelOpen(false);
      setCancelReason('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? BOOKING_ERROR_MAP[err.code] ?? err.message : 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    if (!booking) return;
    setBusy(true);
    try {
      await markBookingPaid(booking._id);
      await load(booking._id);
      toast.success('Marked as paid');
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? BOOKING_ERROR_MAP[err.code] ?? err.message : 'Failed to mark paid');
    } finally {
      setBusy(false);
    }
  }

  function onTransitionClick(t: BookingTransition) {
    if (t.kind === 'cancel') {
      setCancelOpen(true);
    } else if (t.kind === 'complete') {
      setCompleteOpen(true);
    } else {
      setPendingStatus(t);
    }
  }

  const transitions = booking ? BOOKING_TRANSITIONS[booking.status] ?? [] : [];
  const canMarkPaid =
    !!booking &&
    booking.requiresPayment &&
    booking.paymentStatus !== 'paid' &&
    (!booking.paymentMethod || booking.paymentMethod === 'cash');
  const canReschedule = !!booking && (booking.status === 'pending' || booking.status === 'confirmed');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0 flex flex-col', sheet.className)}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Booking</SheetTitle>
        </SheetHeader>

        <SheetBody className="p-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : booking ? (
            <div className="space-y-5">
              {/* Summary */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{productTitle(booking)}</h2>
                  <BookingStatusBadge status={booking.status} />
                </div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {formatDateTime(booking.startAt)} – {formatTime(booking.endAt)}
                </p>
              </div>

              {/* Customer */}
              <InfoCard icon={<User className="h-4 w-4" />} title="Customer">
                <p className="text-sm">{customerEmail(booking)}</p>
              </InfoCard>

              {/* Payment */}
              <InfoCard icon={<Banknote className="h-4 w-4" />} title="Payment">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {formatMinor(booking.priceSnapshot, booking.currency)}
                  </span>
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {booking.requiresPayment ? 'Payment required' : 'No payment required'}
                  {booking.paymentMethod && ` · ${booking.paymentMethod}`}
                  {booking.paidAt && ` · paid ${formatDateTime(booking.paidAt)}`}
                </p>
                {booking.paymentStatus === 'disputed' && (
                  <p className="mt-2 rounded-md bg-orange-50 px-2.5 py-2 text-xs text-orange-700">
                    The customer opened a chargeback on this payment. Stripe is resolving it —
                    no action is needed. If lost, the booking is refunded and cancelled.
                  </p>
                )}
              </InfoCard>

              {booking.cancelledReason && (
                <InfoCard icon={<Ban className="h-4 w-4" />} title="Cancellation reason">
                  <p className="text-sm text-muted-foreground">{booking.cancelledReason}</p>
                </InfoCard>
              )}
            </div>
          ) : null}
        </SheetBody>

        {booking && (transitions.length > 0 || canMarkPaid || canReschedule) && (
          <SheetFooter className="flex-col gap-2 border-t">
            {canMarkPaid && (
              <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={handleMarkPaid}>
                <CheckCircle2 className="h-4 w-4" /> Mark cash payment received
              </Button>
            )}
            {canReschedule && (
              <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={() => setRescheduleOpen(true)}>
                <CalendarSync className="h-4 w-4" /> Reschedule
              </Button>
            )}
            {transitions.map((t) => (
              <Button
                key={t.target}
                variant={t.tone === 'destructive' ? 'outline' : 'default'}
                className={cn('w-full', t.tone === 'destructive' && 'text-destructive hover:text-destructive')}
                disabled={busy}
                onClick={() => onTransitionClick(t)}
              >
                {t.label}
              </Button>
            ))}
          </SheetFooter>
        )}
      </SheetContent>

      {/* Non-cancel status confirmation */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => { if (!o) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingStatus?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Apply this change? Confirmed bookings sync to your Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (pendingStatus) applyStatus(pendingStatus.target); }}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel with reason */}
      <AlertDialog open={cancelOpen} onOpenChange={(o) => { if (!o) { setCancelOpen(false); setCancelReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The calendar event is removed and the customer is notified. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={CANCEL_REASON_MAX}
            rows={3}
            placeholder="Reason (optional)"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RescheduleSheet
        bookingId={booking?._id ?? null}
        productId={booking ? refId(booking.productId) : null}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onRescheduled={() => { if (booking) load(booking._id); onChanged(); }}
      />

      <CompleteBookingDialog
        booking={booking}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onCompleted={() => { if (booking) load(booking._id); onChanged(); }}
      />
    </Sheet>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
