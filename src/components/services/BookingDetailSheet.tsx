import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, XCircle, CalendarClock, User, Banknote, CalendarSync,
  CheckCircle2, Ban, Receipt,
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
import { useTranslation, useFormatters, useApiError } from '@/i18n';
import {
  fetchBookingById, updateBookingStatus, markBookingPaid, cancelBooking,
  settleBookingBalance,
} from '@/services/services.service';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/services/StatusBadges';
import { RescheduleSheet } from '@/components/services/RescheduleSheet';
import { CompleteBookingDialog } from '@/components/services/CompleteBookingDialog';
import {
  toMajorUnits,
  BOOKING_TRANSITIONS, CANCEL_REASON_MAX, type BookingTransition,
} from '@/components/services/service.constants';
import { responsiveSheetProps } from '@/components/ui/responsive-sheet';
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

export function BookingDetailSheet({ bookingId, open, onOpenChange, onChanged }: BookingDetailSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-lg');

  const productTitle = (b: Booking): string =>
    typeof b.productId === 'object' ? b.productId.title : t('services.bookings.untitledService');

  const customerEmail = (b: Booking): string =>
    (typeof b.userId === 'object' ? b.userId.login_email : null) ?? t('common.labels.emptyValue');

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
      setError(apiError.resolve(err, { fallbackKey: 'services.errors.loadBookingFailed' }));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

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
      toast.success(t('services.toast.bookingUpdated'));
      setPendingStatus(null);
      onChanged();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.bookingUpdateFailed' });
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
      toast.success(t('services.toast.bookingCancelled'));
      setCancelOpen(false);
      setCancelReason('');
      onChanged();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.bookingCancelFailed' });
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
      toast.success(t('services.toast.markedPaid'));
      onChanged();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.markPaidFailed' });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Record the completion balance as taken in cash.
   *
   * A service business usually collects an overrun at the counter rather than
   * chasing an online payment; without this the balance sits open forever on a
   * booking the vendor considers finished. Sends no `amount`, which settles the
   * whole outstanding balance.
   */
  async function handleSettleBalance() {
    if (!booking) return;
    setBusy(true);
    try {
      await settleBookingBalance(booking._id);
      await load(booking._id);
      toast.success(t('services.toast.balanceSettled'));
      onChanged();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.settleBalanceFailed' });
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
  /**
   * What completion settled to, and what of it is still outstanding. Only a
   * completed booking has a `settlement`, so an unfinished one shows nothing.
   */
  const settlement = booking?.settlement ?? null;
  const outstandingBalance = settlement
    ? Math.max(0, settlement.balanceDue - settlement.balancePaid)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0 flex flex-col', sheet.className)}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{t('services.detail.title')}</SheetTitle>
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
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t('common.actions.close')}</Button>
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
                  {fmt.dateTime(booking.startAt)} – {fmt.time(booking.endAt)}
                </p>
              </div>

              {/* Customer */}
              <InfoCard icon={<User className="h-4 w-4" />} title={t('services.detail.customer')}>
                <p className="text-sm">{customerEmail(booking)}</p>
              </InfoCard>

              {/* Payment */}
              <InfoCard icon={<Banknote className="h-4 w-4" />} title={t('services.detail.payment')}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {fmt.currency(toMajorUnits(booking.priceSnapshot), booking.currency)}
                  </span>
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {booking.requiresPayment
                    ? t('services.detail.paymentRequired')
                    : t('services.detail.paymentNotRequired')}
                  {booking.paymentMethod && ` · ${booking.paymentMethod}`}
                  {booking.paidAt &&
                    ` · ${t('services.detail.paidAt', { date: fmt.dateTime(booking.paidAt) })}`}
                </p>
                {booking.paymentStatus === 'disputed' && (
                  <p className="mt-2 rounded-md bg-orange-50 px-2.5 py-2 text-xs text-orange-700">
                    {t('services.detail.disputeNotice')}
                  </p>
                )}
              </InfoCard>

              {/* Settlement — only after completion, and only worth a card when
                  the final price moved off the quote or money is still open. */}
              {settlement && (
                <InfoCard icon={<Receipt className="h-4 w-4" />} title={t('services.detail.settlement')}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('services.detail.finalPrice')}</span>
                    <span className="font-medium">
                      {fmt.currency(toMajorUnits(settlement.finalPrice), booking.currency)}
                    </span>
                  </div>
                  {outstandingBalance > 0 ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      {t('services.detail.balanceOutstanding', {
                        amount: fmt.currency(toMajorUnits(outstandingBalance), booking.currency),
                      })}
                    </p>
                  ) : settlement.balanceDue > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('services.detail.balanceSettled', {
                        method: settlement.balancePaymentMethod ?? '',
                      })}
                    </p>
                  ) : null}
                  {settlement.creditDue > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('services.detail.creditRecorded', {
                        amount: fmt.currency(toMajorUnits(settlement.creditDue), booking.currency),
                      })}
                    </p>
                  )}
                </InfoCard>
              )}

              {booking.cancelledReason && (
                <InfoCard icon={<Ban className="h-4 w-4" />} title={t('services.detail.cancellationReason')}>
                  <p className="text-sm text-muted-foreground">{booking.cancelledReason}</p>
                </InfoCard>
              )}
            </div>
          ) : null}
        </SheetBody>

        {booking && (transitions.length > 0 || canMarkPaid || canReschedule || outstandingBalance > 0) && (
          <SheetFooter className="flex-col gap-2 border-t">
            {canMarkPaid && (
              <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={handleMarkPaid}>
                <CheckCircle2 className="h-4 w-4" /> {t('services.detail.markCashReceived')}
              </Button>
            )}
            {/* Distinct from "cash received" above, which settles the ORIGINAL
                price of an unpaid booking. This settles the completion balance
                on one that was already paid. */}
            {outstandingBalance > 0 && (
              <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={handleSettleBalance}>
                <Banknote className="h-4 w-4" />
                {t('services.detail.settleBalanceInCash', {
                  amount: fmt.currency(toMajorUnits(outstandingBalance), booking.currency),
                })}
              </Button>
            )}
            {canReschedule && (
              <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={() => setRescheduleOpen(true)}>
                <CalendarSync className="h-4 w-4" /> {t('services.detail.reschedule')}
              </Button>
            )}
            {transitions.map((transition) => (
              <Button
                key={transition.target}
                variant={transition.tone === 'destructive' ? 'outline' : 'default'}
                className={cn('w-full', transition.tone === 'destructive' && 'text-destructive hover:text-destructive')}
                disabled={busy}
                onClick={() => onTransitionClick(transition)}
              >
                {t(transition.labelKey)}
              </Button>
            ))}
          </SheetFooter>
        )}
      </SheetContent>

      {/* Non-cancel status confirmation */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => { if (!o) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingStatus ? t(pendingStatus.labelKey) : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('services.detail.statusConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (pendingStatus) applyStatus(pendingStatus.target); }}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.actions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel with reason */}
      <AlertDialog open={cancelOpen} onOpenChange={(o) => { if (!o) { setCancelOpen(false); setCancelReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('services.detail.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('services.detail.cancelDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={CANCEL_REASON_MAX}
            rows={3}
            placeholder={t('services.detail.cancelReasonPlaceholder')}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('services.detail.keepBooking')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('services.detail.confirmCancel')}
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
