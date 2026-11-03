import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { BookingPriceField } from '@/components/services/BookingPriceField';
import { proposedPriceError } from '@/components/services/service.constants';
import { isStaleBookingRefusal, useBookingPriceError } from '@/components/services/useBookingPriceError';
import { useTranslation, useFormatters } from '@/i18n';
import { answerRescheduleProposal, proposeBookingPrice } from '@/services/services.service';
import type { Booking } from '@/types/services.types';

/**
 * `propose` asks for more on a pending booking, so it must beat the booked price.
 * `accept` answers a customer's request for a new time, where the booked price
 * itself is allowed and a price below what they paid refunds the difference.
 */
export type BookingPriceDialogMode = 'propose' | 'accept';

interface BookingPriceDialogProps {
  booking: Booking | null;
  mode: BookingPriceDialogMode | null;
  onClose: () => void;
  /** Sent, or refused because the screen was out of date: read the booking again. */
  onStale: () => void;
}

export function BookingPriceDialog({ booking, mode, onClose, onStale }: BookingPriceDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const currency = booking?.currency ?? 'XAF';
  const priceError = useBookingPriceError(currency);
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setValue('');
    setSubmitted(false);
  }, [mode]);

  const pricing = booking?.pricing;
  const minimum = pricing?.originalPrice ?? 0;
  const minimumText = fmt.currency(minimum, currency);
  const errorKey = proposedPriceError(value, minimum, mode === 'propose' ? 'above' : 'atLeast');
  const fieldError = errorKey && (submitted || value.trim() !== '')
    ? t(errorKey, { minimum: minimumText })
    : null;

  async function send() {
    if (!booking || !mode) return;
    setSubmitted(true);
    if (errorKey) return;
    setBusy(true);
    try {
      if (mode === 'propose') {
        await proposeBookingPrice(booking.id, Number(value));
        toast.success(t('services.pricing.sent'));
      } else {
        const updated = await answerRescheduleProposal(booking.id, 'accept', Number(value));
        // The same price as now is a plain accept, and the booking moves.
        toast.success(t(updated.rescheduleProposal?.status === 'open'
          ? 'services.pricing.acceptSent'
          : 'services.proposal.accepted'));
      }
      onStale();
      onClose();
    } catch (err) {
      toast.error(priceError(err, 'services.pricing.sendFailed'));
      if (isStaleBookingRefusal(err)) {
        onStale();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveModal
      open={!!mode}
      onOpenChange={(o) => { if (!o && !busy) onClose(); }}
      title={t(mode === 'accept' ? 'services.pricing.acceptTitle' : 'services.pricing.proposeTitle')}
      description={t(mode === 'accept' ? 'services.pricing.acceptDescription' : 'services.pricing.proposeDescription')}
      desktopClassName="sm:max-w-md"
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <div className="flex w-full gap-2 sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-none" disabled={busy} onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button className="flex-1 sm:flex-none" disabled={busy} onClick={() => void send()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('services.pricing.send')}
          </Button>
        </div>
      }
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <BookingPriceField
          id="booking-price"
          label={t('services.pricing.priceLabel')}
          value={value}
          onChange={setValue}
          currency={currency}
          hint={t(mode === 'accept' ? 'services.pricing.hintAtLeast' : 'services.pricing.hintAbove', { minimum: minimumText })}
          error={fieldError}
          // On approval the price only ever goes up, so nothing can be refunded.
          amountPaid={mode === 'accept' ? pricing?.amountPaid ?? 0 : 0}
        />
      </form>
    </ResponsiveModal>
  );
}
