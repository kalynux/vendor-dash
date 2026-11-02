import { api } from './api';
import type { PartialPaymentTerms } from '@/types/partial-payment.types';

// api-doc/vendor/profile.md § Partial payment (2026-11-01).
//
// ⚠ Separate from the COD terms: a vendor with cash on delivery off can still
// accept this. Like them, it is not part of `PATCH /vendor/profile` policies, so
// changing it never pauses agency connections.

interface PartialPaymentResponse {
  success: boolean;
  data: PartialPaymentTerms;
}

export async function fetchPartialPayment(): Promise<PartialPaymentTerms> {
  const res = await api.get<PartialPaymentResponse>('/vendor/profile/partial-payment');
  return res.data;
}

/** Full replace — both keys are required by the `.strict()` validator, `minPercent` as `null` when unset. */
export async function updatePartialPayment(terms: Pick<PartialPaymentTerms, 'enabled' | 'minPercent'>): Promise<PartialPaymentTerms> {
  const res = await api.put<PartialPaymentResponse>('/vendor/profile/partial-payment', {
    enabled: terms.enabled,
    minPercent: terms.minPercent,
  });
  return res.data;
}
