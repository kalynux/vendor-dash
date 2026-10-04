import { api } from './api';
import type { DeliveryTerms } from '@/types/delivery-terms.types';

// api-doc/vendor/profile.md § Delivery terms (2026-10-03).
//
// Like the COD terms, deliberately NOT part of `PATCH /vendor/profile`
// policies: these terms neither bump `policy_version` nor pause agency
// connections.

interface DeliveryTermsResponse {
  success: boolean;
  data: DeliveryTerms;
}

export async function fetchDeliveryTerms(): Promise<DeliveryTerms> {
  const res = await api.get<DeliveryTermsResponse>('/vendor/profile/delivery-terms');
  return res.data;
}

/**
 * Full replace (`.strict()`). `freeAboveAmount` is sent as `null` unless the
 * mode is `above` — any other pairing is a 400.
 */
export async function updateDeliveryTerms(terms: Pick<DeliveryTerms, 'mode' | 'freeAboveAmount'>): Promise<DeliveryTerms> {
  const res = await api.put<DeliveryTermsResponse>('/vendor/profile/delivery-terms', {
    mode: terms.mode,
    freeAboveAmount: terms.mode === 'above' ? terms.freeAboveAmount : null,
  });
  return res.data;
}
