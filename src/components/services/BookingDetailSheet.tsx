import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, XCircle, CalendarClock, User, Banknote, CalendarSync,
  CheckCircle2, Ban, Receipt, MessageSquareText, Hourglass, MapPin, Navigation, Video,
  KeyRound, Pencil, BellRing, CircleDollarSign, UserX, type LucideIcon,
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
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import {
  fetchBookingById, updateBookingStatus, markBookingPaid, cancelBooking,
  settleBookingBalance, withdrawRescheduleProposal, answerRescheduleProposal,
  withdrawBookingPrice, sendBookingReminder,
} from '@/services/services.service';
import { BookingAccessEditor } from '@/components/services/BookingAccessEditor';
import { BookingPriceDialog, type BookingPriceDialogMode } from '@/components/services/BookingPriceDialog';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/services/StatusBadges';
import { RescheduleSheet } from '@/components/services/RescheduleSheet';
import { CompleteBookingDialog } from '@/components/services/CompleteBookingDialog';
import { isStaleBookingRefusal, useBookingPriceError } from '@/components/services/useBookingPriceError';
import {
  canRepriceWithNewTime, customerNote, mapsUrl, REVEAL_MINUTES_DEFAULT,
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

function refId(ref: { id: string } | string | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref.id;
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

  const customerPhone = (b: Booking): string | null =>
    (typeof b.userId === 'object' ? b.userId.login_phone : null) || null;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<BookingTransition | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [priceDialog, setPriceDialog] = useState<BookingPriceDialogMode | null>(null);

  const currency = booking?.currency ?? 'XAF';
  const priceError = useBookingPriceError(currency);

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

  /**
   * Read the booking again in place, after every action. Only this read carries
   * everything on screen together: the replies to the actions have no `reminder`,
   * most have no `pricing`, and their product and customer are bare ids.
   */
  const reread = useCallback(async (id: string) => {
    try {
      setBooking(await fetchBookingById(id));
    } catch {
      // The action itself went through; what is on screen stays until the next open.
    }
  }, []);

  useEffect(() => {
    if (open && bookingId) load(bookingId);
    if (!open) { setBooking(null); setError(null); setCancelReason(''); }
  }, [open, bookingId, load]);

  /** Say why it was refused and, if the screen was out of date, redraw it. */
  async function showRefusal(err: unknown, fallbackKey: TranslationKey) {
    toast.error(priceError(err, fallbackKey));
    if (booking && isStaleBookingRefusal(err)) await reread(booking.id);
  }

  async function applyStatus(target: BookingTransition['target']) {
    if (!booking) return;
    setBusy(true);
    try {
      await updateBookingStatus(booking.id, target);
      await reread(booking.id);
      toast.success(t('services.toast.bookingUpdated'));
      setPendingStatus(null);
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.errors.bookingUpdateFailed');
      if (isStaleBookingRefusal(err)) setPendingStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!booking) return;
    setBusy(true);
    try {
      await cancelBooking(booking.id, cancelReason.trim() || undefined);
      await reread(booking.id);
      toast.success(t('services.toast.bookingCancelled'));
      setCancelOpen(false);
      setCancelReason('');
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.errors.bookingCancelFailed');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    if (!booking) return;
    setBusy(true);
    try {
      await markBookingPaid(booking.id);
      await reread(booking.id);
      toast.success(t('services.toast.markedPaid'));
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.errors.markPaidFailed');
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
      await settleBookingBalance(booking.id);
      await reread(booking.id);
      toast.success(t('services.toast.balanceSettled'));
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.errors.settleBalanceFailed');
    } finally {
      setBusy(false);
    }
  }

  /** The price difference, taken at the counter. Sends no `amount`: it must cover all of it. */
  async function handleCollectTopup() {
    if (!booking) return;
    setBusy(true);
    try {
      await settleBookingBalance(booking.id);
      await reread(booking.id);
      toast.success(t('services.pricing.collected'));
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.pricing.collectFailed');
    } finally {
      setBusy(false);
    }
  }

  /** Take back the shop's own open proposal — the booking keeps its time. */
  async function handleWithdrawProposal() {
    if (!booking) return;
    setBusy(true);
    try {
      await withdrawRescheduleProposal(booking.id);
      await reread(booking.id);
      toast.success(t('services.proposal.withdrawn'));
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.proposal.actionFailed'); // it may have been answered or lapsed meanwhile
    } finally {
      setBusy(false);
    }
  }

  /** Answer a customer's request to move (manual-approval services). */
  async function handleAnswerProposal(answer: 'accept' | 'decline') {
    if (!booking) return;
    setBusy(true);
    try {
      await answerRescheduleProposal(booking.id, answer);
      await reread(booking.id);
      toast.success(t(answer === 'accept' ? 'services.proposal.accepted' : 'services.proposal.declined'));
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.proposal.actionFailed');
    } finally {
      setBusy(false);
    }
  }

  /** Take back the shop's open price — the booking can be confirmed again. */
  async function handleWithdrawPrice() {
    if (!booking) return;
    setBusy(true);
    try {
      await withdrawBookingPrice(booking.id);
      await reread(booking.id);
      toast.success(t('services.pricing.withdrawn'));
      onChanged();
    } catch (err) {
      await showRefusal(err, 'services.pricing.withdrawFailed'); // it may have been answered or lapsed meanwhile
    } finally {
      setBusy(false);
    }
  }

  /** The one reminder. Its reply is only the `reminder` block, so nothing else is redrawn. */
  async function handleSendReminder() {
    if (!booking) return;
    setBusy(true);
    try {
      const reminder = await sendBookingReminder(booking.id);
      setBooking((current) => current && { ...current, reminder });
      toast.success(t('services.reminder.sentToast'));
    } catch (err) {
      await showRefusal(err, 'services.reminder.failed');
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

  const pricing = booking?.pricing ?? null;
  const priceOpen = pricing?.proposal?.status === 'open';
  const topup = pricing?.topup ?? null;
  const canPropose = !!pricing?.canPropose;
  // The server refuses a confirm while a price waits (`BOOKING_PRICE_PROPOSAL_OPEN`).
  const transitions = (booking ? BOOKING_TRANSITIONS[booking.status] ?? [] : [])
    .filter((transition) => !(priceOpen && transition.target === 'confirmed'));
  const canMarkPaid =
    !!booking &&
    booking.requiresPayment &&
    booking.paymentStatus !== 'paid' &&
    (!booking.paymentMethod || booking.paymentMethod === 'cash');
  const isOpenBooking = !!booking && (booking.status === 'pending' || booking.status === 'confirmed');
  const openProposal = booking?.rescheduleProposal?.status === 'open' ? booking.rescheduleProposal : null;
  // One proposal at a time — a second is `409 BOOKING_PROPOSAL_PENDING`.
  const canReschedule = isOpenBooking && !openProposal;
  /**
   * What completion settled to, and what of it is still outstanding. Only a
   * completed booking has a `settlement`, so an unfinished one shows nothing.
   */
  const settlement = booking?.settlement ?? null;
  // The one route clears a price difference first, so only one of the two can be offered.
  const outstandingBalance = settlement && !topup
    ? Math.max(0, settlement.balanceDue - settlement.balancePaid)
    : 0;
  const canReprice = !!booking && canRepriceWithNewTime(booking);

  // Money first, then changes to the booking, then what ends it: the order they stack in.
  const actions: BookingAction[] = [];
  if (booking) {
    if (canMarkPaid) {
      actions.push({ id: 'mark-paid', label: t('services.detail.markCashReceived'), icon: CheckCircle2, onClick: handleMarkPaid });
    }
    if (topup) {
      actions.push({
        id: 'collect-topup',
        label: t('services.pricing.collectedInCash', { amount: fmt.currency(topup.amount, booking.currency) }),
        icon: Banknote,
        onClick: handleCollectTopup,
      });
    }
    // Distinct from "cash received" above, which settles the ORIGINAL price of an
    // unpaid booking. This settles the completion balance on one that was already paid.
    if (outstandingBalance > 0) {
      actions.push({
        id: 'settle-balance',
        label: t('services.detail.settleBalanceInCash', { amount: fmt.currency(outstandingBalance, booking.currency) }),
        icon: Banknote,
        onClick: handleSettleBalance,
      });
    }
    if (canReschedule) {
      actions.push({ id: 'reschedule', label: t('services.detail.reschedule'), icon: CalendarSync, onClick: () => setRescheduleOpen(true) });
    }
    if (canPropose) {
      actions.push({
        id: 'propose-price',
        label: t(pricing?.proposal ? 'services.pricing.proposeAgain' : 'services.pricing.propose'),
        icon: CircleDollarSign,
        onClick: () => setPriceDialog('propose'),
      });
    }
    for (const transition of transitions) {
      actions.push({
        id: transition.target,
        label: t(transition.labelKey),
        icon: transition.kind === 'cancel' ? Ban : UserX,
        tone: transition.tone === 'destructive' ? 'destructive' : 'main',
        onClick: () => onTransitionClick(transition),
      });
    }
  }

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
                {booking.bookingNumber && (
                  <p className="text-xs text-muted-foreground">
                    {t('services.detail.bookingNumber', { number: booking.bookingNumber })}
                  </p>
                )}
              </div>

              <ProposalNotice
                booking={booking}
                busy={busy}
                canReprice={canReprice}
                onWithdraw={handleWithdrawProposal}
                onAnswer={handleAnswerProposal}
                onAcceptWithPrice={() => setPriceDialog('accept')}
              />

              <PriceNotice booking={booking} busy={busy} onWithdraw={handleWithdrawPrice} />

              <LocationBlock booking={booking} />

              {/* Customer — with their note, which is what the vendor prepares from. */}
              <InfoCard icon={<User className="h-4 w-4" />} title={t('services.detail.customer')}>
                <p className="text-sm">{customerEmail(booking)}</p>
                {customerPhone(booking) && (
                  <a href={`tel:${customerPhone(booking)}`} className="mt-0.5 block text-sm text-primary underline-offset-2 hover:underline">
                    {customerPhone(booking)}
                  </a>
                )}
              </InfoCard>

              {customerNote(booking.metadata) && (
                <InfoCard icon={<MessageSquareText className="h-4 w-4" />} title={t('services.detail.customerNote')}>
                  <p className="whitespace-pre-line break-words text-sm">{customerNote(booking.metadata)}</p>
                </InfoCard>
              )}

              <ReminderBlock booking={booking} busy={busy} onSend={handleSendReminder} />

              <AccessBlock booking={booking} canEdit={isOpenBooking} onEdit={() => setAccessOpen(true)} />

              {/* Payment. `priceSnapshot` is the agreed price, which may not be the first quote. */}
              <InfoCard icon={<Banknote className="h-4 w-4" />} title={t('services.detail.payment')}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">
                      {fmt.currency(pricing?.currentPrice ?? booking.priceSnapshot, booking.currency)}
                    </span>
                    {pricing && pricing.originalPrice !== pricing.currentPrice && (
                      <span className="text-xs text-muted-foreground">
                        {t('services.pricing.bookedAt', { amount: fmt.currency(pricing.originalPrice, booking.currency) })}
                      </span>
                    )}
                  </span>
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
                {!!pricing?.amountPaid && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('services.pricing.paidSoFar', { amount: fmt.currency(pricing.amountPaid, booking.currency) })}
                  </p>
                )}
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
                {topup && (
                  <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                    <p className="font-medium">
                      {t('services.pricing.owes', {
                        amount: fmt.currency(topup.amount, booking.currency),
                        date: fmt.dateTime(topup.dueAt),
                      })}
                    </p>
                    <p className="mt-0.5">{t('services.pricing.owesHelp')}</p>
                  </div>
                )}
              </InfoCard>

              {/* Settlement — only after completion, and only worth a card when
                  the final price moved off the quote or money is still open. */}
              {settlement && (
                <InfoCard icon={<Receipt className="h-4 w-4" />} title={t('services.detail.settlement')}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('services.detail.finalPrice')}</span>
                    <span className="font-medium">
                      {fmt.currency(settlement.finalPrice, booking.currency)}
                    </span>
                  </div>
                  {outstandingBalance > 0 ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      {t('services.detail.balanceOutstanding', {
                        amount: fmt.currency(outstandingBalance, booking.currency),
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
                        amount: fmt.currency(settlement.creditDue, booking.currency),
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

        <BookingActionsFooter actions={actions} busy={busy} />
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
              {booking?.paymentStatus === 'paid' && ` ${t('services.detail.cancelPaidNote')}`}
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
        bookingId={booking?.id ?? null}
        productId={booking ? refId(booking.productId) : null}
        bookingStartAt={booking?.startAt ?? null}
        bookingEndAt={booking?.endAt ?? null}
        currency={currency}
        priceRules={canReprice && pricing
          ? { minimum: pricing.originalPrice, current: pricing.currentPrice, amountPaid: pricing.amountPaid }
          : null}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onProposed={() => { if (booking) void reread(booking.id); onChanged(); }}
        onStale={() => { if (booking) void reread(booking.id); }}
      />

      <BookingAccessEditor
        booking={booking}
        open={accessOpen}
        onOpenChange={setAccessOpen}
        onSaved={() => { if (booking) void reread(booking.id); onChanged(); }}
      />

      <CompleteBookingDialog
        booking={booking}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onCompleted={() => { if (booking) void reread(booking.id); onChanged(); }}
      />

      <BookingPriceDialog
        booking={booking}
        mode={priceDialog}
        onClose={() => setPriceDialog(null)}
        onStale={() => { if (booking) void reread(booking.id); onChanged(); }}
      />
    </Sheet>
  );
}

interface BookingAction {
  id: string;
  label: string;
  /** Beside the label in the sheet, and on the plain buttons unless destructive. */
  icon: LucideIcon;
  tone?: 'main' | 'destructive';
  onClick: () => void;
}

/** Up to this many actions a phone just shows them: a sheet for one or two only adds a tap. */
const PHONE_VISIBLE_ACTIONS = 2;

/**
 * The booking's actions. Five stacked buttons left a phone about half the screen
 * for the booking itself, so past two it keeps the main one in view and the rest
 * open from "More actions". Above `md` the panel has the room, so they all stay.
 */
function BookingActionsFooter({ actions, busy }: { actions: BookingAction[]; busy: boolean }) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  if (actions.length === 0) return null;

  if (!isMobile || actions.length <= PHONE_VISIBLE_ACTIONS) {
    return (
      <SheetFooter className="flex-col gap-2 border-t">
        {actions.map((action) => <BookingActionButton key={action.id} action={action} busy={busy} className="w-full" />)}
      </SheetFooter>
    );
  }

  // No main action while a price waits for the customer: the first one stands in.
  const main = actions.find((action) => action.tone === 'main') ?? actions[0];
  const rest = actions.filter((action) => action !== main);

  return (
    <SheetFooter className="flex-row gap-2 border-t">
      <BookingActionButton action={main} busy={busy} className="min-w-0 flex-1" />
      <Button variant="outline" className="shrink-0" disabled={busy} onClick={() => setMoreOpen(true)}>
        {t('services.detail.moreActions')}
      </Button>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-2xl p-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{t('services.detail.moreActions')}</SheetTitle>
          </SheetHeader>
          <div className="py-1">
            {rest.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setMoreOpen(false);
                  action.onClick();
                }}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent',
                  'disabled:pointer-events-none disabled:opacity-50',
                  action.tone === 'destructive' && 'text-destructive',
                )}
              >
                <action.icon className="h-5 w-5 shrink-0" />
                {action.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </SheetFooter>
  );
}

function BookingActionButton({ action, busy, className }: { action: BookingAction; busy: boolean; className?: string }) {
  const destructive = action.tone === 'destructive';
  return (
    <Button
      variant={action.tone === 'main' ? 'default' : 'outline'}
      className={cn('gap-2', className, destructive && 'text-destructive hover:text-destructive')}
      disabled={busy}
      onClick={action.onClick}
    >
      {!destructive && action.tone !== 'main' && <action.icon className="h-4 w-4" />}
      {action.label}
    </Button>
  );
}

/**
 * A proposed new time. The booking keeps its own time until the other side
 * answers, so this must never read as "moved".
 */
function ProposalNotice({
  booking, busy, canReprice, onWithdraw, onAnswer, onAcceptWithPrice,
}: {
  booking: Booking;
  busy: boolean;
  canReprice: boolean;
  onWithdraw: () => void;
  onAnswer: (answer: 'accept' | 'decline') => void;
  onAcceptWithPrice: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const p = booking.rescheduleProposal;
  if (!p) return null;
  const when = t('services.proposal.timeRange', { start: fmt.dateTime(p.startAt), end: fmt.time(p.endAt) });
  const money = (amount: number) => fmt.currency(amount, booking.currency);

  if (p.status === 'open') {
    const fromCustomer = p.proposedBy === 'customer';
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Hourglass className="h-4 w-4 shrink-0" />
          {t(fromCustomer ? 'services.proposal.customerAsks' : 'services.proposal.waiting')}
        </p>
        <p className="text-sm">
          {t('services.proposal.proposedTime', { time: when })}
        </p>
        {p.price != null && (
          <p className="text-sm">
            {t('services.proposal.proposedPrice', {
              price: money(p.price),
              previous: money(p.previousPrice ?? booking.priceSnapshot),
            })}
          </p>
        )}
        {p.expiresAt && (
          <p className="text-xs opacity-80">
            {t('services.proposal.expires', { date: fmt.dateTime(p.expiresAt) })}
          </p>
        )}
        {fromCustomer ? (
          <>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-11 flex-1 md:h-9" disabled={busy} onClick={() => onAnswer('accept')}>
                {t('services.proposal.accept')}
              </Button>
              <Button size="sm" variant="outline" className="h-11 flex-1 bg-background md:h-9" disabled={busy} onClick={() => onAnswer('decline')}>
                {t('services.proposal.decline')}
              </Button>
            </div>
            {canReprice && (
              <Button size="sm" variant="outline" className="h-11 w-full bg-background md:h-9" disabled={busy} onClick={onAcceptWithPrice}>
                {t('services.proposal.acceptWithPrice')}
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" variant="outline" className="h-11 w-full bg-background md:h-9 md:w-auto" disabled={busy} onClick={onWithdraw}>
            {t('services.proposal.withdraw')}
          </Button>
        )}
      </div>
    );
  }

  // The vendor's own proposal that didn't go through — worth one quiet line,
  // because the customer may now cancel with a full refund.
  if (p.proposedBy === 'vendor' && (p.status === 'declined' || p.status === 'lapsed')) {
    return (
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        {t(p.status === 'declined' ? 'services.proposal.declinedByCustomer' : 'services.proposal.lapsed', { time: when })}
        {p.price != null && ` ${t('services.proposal.priceStays', { price: money(booking.priceSnapshot) })}`}
      </p>
    );
  }
  return null;
}

/**
 * A proposed price on a booking still waiting for approval. Accepting confirms it
 * at once, so `accepted` is a quiet line that asks nothing more of the vendor.
 */
function PriceNotice({
  booking, busy, onWithdraw,
}: {
  booking: Booking;
  busy: boolean;
  onWithdraw: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const pricing = booking.pricing;
  const p = pricing?.proposal;
  if (!pricing || !p) return null;
  const amount = fmt.currency(p.amount, booking.currency);
  const current = fmt.currency(pricing.currentPrice, booking.currency);

  if (p.status === 'open') {
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Hourglass className="h-4 w-4 shrink-0" />
          {t('services.pricing.waiting')}
        </p>
        <p className="text-sm">{t('services.pricing.proposed', { amount, current })}</p>
        <p className="text-xs opacity-80">
          {t('services.pricing.expires', { date: fmt.dateTime(p.expiresAt) })}
        </p>
        <Button size="sm" variant="outline" className="h-11 w-full bg-background md:h-9 md:w-auto" disabled={busy} onClick={onWithdraw}>
          {t('services.pricing.withdraw')}
        </Button>
      </div>
    );
  }

  // A later price agreed with a new time replaces this one, so it stops being news.
  if (p.status === 'accepted') {
    if (p.amount !== pricing.currentPrice) return null;
    return <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('services.pricing.acceptedNote', { amount })}</p>;
  }

  // Past the point of approval the question is closed.
  if (booking.status !== 'pending') return null;
  const noteKey = {
    declined: 'services.pricing.declinedNote',
    withdrawn: 'services.pricing.withdrawnNote',
    lapsed: 'services.pricing.lapsedNote',
  } as const;
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
      {t(noteKey[p.status], { amount })}
      {pricing.canPropose && ` ${t('services.pricing.nextSteps', { current })}`}
    </p>
  );
}

/** The shop's one reminder, and the customer's to the shop. The two are independent. */
function ReminderBlock({
  booking, busy, onSend,
}: {
  booking: Booking;
  busy: boolean;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const reminder = booking.reminder;
  if (!reminder || (!reminder.canSend && !reminder.sentAt && !reminder.receivedAt)) return null;

  return (
    <InfoCard icon={<BellRing className="h-4 w-4" />} title={t('services.reminder.title')}>
      {reminder.receivedAt && (
        <p className="text-sm">{t('services.reminder.received', { date: fmt.dateTime(reminder.receivedAt) })}</p>
      )}
      {reminder.sentAt && (
        <p className="text-sm">{t('services.reminder.sent', { date: fmt.dateTime(reminder.sentAt) })}</p>
      )}
      {reminder.canSend && (
        <div className={cn(reminder.receivedAt && 'mt-2')}>
          <Button variant="outline" size="sm" className="h-11 w-full md:h-9 md:w-auto" disabled={busy} onClick={onSend}>
            {t('services.reminder.send')}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">{t('services.reminder.oneOnly')}</p>
        </div>
      )}
    </InfoCard>
  );
}

/** Where it happens. Going to the customer is the one the vendor must not miss. */
function LocationBlock({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const loc = booking.location;
  if (!loc) return null;

  if (loc.kind === 'online') {
    return (
      <InfoCard icon={<Video className="h-4 w-4" />} title={t('services.location.title')}>
        <p className="text-sm">{t('services.location.online')}</p>
      </InfoCard>
    );
  }

  const lines = [
    loc.formattedAddress || [loc.addressLine1, loc.addressLine2].filter(Boolean).join(', '),
    loc.formattedAddress ? null : [loc.city, loc.state].filter(Boolean).join(', '),
  ].filter(Boolean) as string[];
  const maps = mapsUrl(loc);

  if (loc.kind === 'customer_address') {
    return (
      <div className="space-y-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <MapPin className="h-4 w-4" />
          {t('services.location.goToCustomer')}
        </p>
        {loc.label && <p className="text-sm font-medium">{loc.label}</p>}
        {lines.length > 0
          ? lines.map((l) => <p key={l} className="text-base font-semibold leading-snug">{l}</p>)
          : <p className="text-sm text-muted-foreground">{t('services.location.noAddressYet')}</p>}
        {maps && (
          <Button asChild variant="outline" size="sm" className="h-11 w-full gap-2 bg-background md:h-9 md:w-auto">
            <a href={maps} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" /> {t('services.location.openInMaps')}
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <InfoCard icon={<MapPin className="h-4 w-4" />} title={t('services.location.title')}>
      <p className="text-sm">{t('services.location.atYourAddress')}</p>
      {loc.label && <p className="text-sm font-medium">{loc.label}</p>}
      {lines.map((l) => <p key={l} className="text-sm text-muted-foreground">{l}</p>)}
    </InfoCard>
  );
}

/** This booking's own link + instructions, and when the customer will see them. */
function AccessBlock({ booking, canEdit, onEdit }: { booking: Booking; canEdit: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  const a = booking.access;
  const hasContent = !!(a?.meetingUrl || a?.instructions);
  // Nothing to show and nothing the vendor can do about it.
  if (!hasContent && !canEdit) return null;

  return (
    <InfoCard icon={<KeyRound className="h-4 w-4" />} title={t('services.access.title')}>
      {a?.meetingUrl && (
        <a
          href={a.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all text-sm text-primary underline-offset-2 hover:underline"
        >
          {a.meetingUrl}
        </a>
      )}
      {a?.instructions && (
        <p className="mt-1 whitespace-pre-line break-words text-sm">{a.instructions}</p>
      )}
      {!hasContent && <p className="text-sm text-muted-foreground">{t('services.access.none')}</p>}
      {hasContent && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('services.access.visibleFrom', { minutes: a?.revealMinutesBefore ?? REVEAL_MINUTES_DEFAULT })}
        </p>
      )}
      {canEdit && (
        <Button variant="outline" size="sm" className="mt-2 h-11 w-full gap-2 md:h-9 md:w-auto" onClick={onEdit}>
          <Pencil className="h-4 w-4" /> {t('services.access.editAction')}
        </Button>
      )}
    </InfoCard>
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
