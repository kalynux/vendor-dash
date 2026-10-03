import { api } from './api';
import type { CodTerms } from '@/types/cod-limits.types';

// api-doc/vendor/profile.md § COD terms (2026-10-02).
//
// ⚠ Deliberately NOT part of `PATCH /vendor/profile` policies: that call bumps
// `policy_version` and pauses every agency connection pending re-approval.
// These terms change neither.

interface CodTermsResponse {
  success: boolean;
  data: CodTerms;
}

export async function fetchCodTerms(): Promise<CodTerms> {
  const res = await api.get<CodTermsResponse>('/vendor/profile/cod-terms');
  return res.data;
}

/** Full replace — both keys are required by the `.strict()` validator. */
export async function updateCodTerms(terms: Pick<CodTerms, 'codEnabled' | 'maxCashPerAgency'>): Promise<CodTerms> {
  const res = await api.put<CodTermsResponse>('/vendor/profile/cod-terms', {
    codEnabled: terms.codEnabled,
    maxCashPerAgency: terms.maxCashPerAgency,
  });
  return res.data;
}
