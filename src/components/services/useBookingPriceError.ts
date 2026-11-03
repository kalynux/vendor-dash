import { useCallback } from 'react';
import { ApiError } from '@/types/api';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';

// `details.reason` on `409 BOOKING_PRICE_NOT_PROPOSABLE` — stable, unlike the message.
const REFUSED_REASON_KEYS: Record<string, TranslationKey> = {
  not_manual: 'services.pricing.refused.not_manual',
  free: 'services.pricing.refused.free',
  not_pending: 'services.pricing.refused.not_pending',
  started: 'services.pricing.refused.started',
  proposal_open: 'services.pricing.refused.proposal_open',
  payment_state: 'services.pricing.refused.payment_state',
};

/**
 * The booking on screen no longer matches the server: the customer answered, a
 * proposal lapsed, or another tab got there first. Redraw from `GET`, because
 * retrying the same button cannot help.
 */
export function isStaleBookingRefusal(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 404 || err.status === 409);
}

/**
 * The sentence for a refused price or booking action: branches on
 * `details.reason`, and shows `details.minimum` as money rather than a bare number.
 */
export function useBookingPriceError(currency: string) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();

  return useCallback((err: unknown, fallbackKey: TranslationKey): string => {
    if (err instanceof ApiError) {
      const details = err.detailsObject ?? {};
      if (err.code === 'BOOKING_PRICE_NOT_PROPOSABLE' && typeof details.reason === 'string') {
        const key = REFUSED_REASON_KEYS[details.reason];
        if (key) return t(key);
      }
      if (err.code === 'BOOKING_PRICE_BELOW_FLOOR' && typeof details.minimum === 'number') {
        return apiError.resolve(err, {
          fallbackKey,
          params: { minimum: fmt.currency(details.minimum, currency) },
        });
      }
    }
    return apiError.resolve(err, { fallbackKey });
  }, [t, fmt, apiError, currency]);
}
