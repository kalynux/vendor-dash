import { api } from './api';
import type {
  PricingPlan,
  CurrentPlanData,
  CreditTransaction,
  CreditPack,
  CreditTopup,
  PlanPurchase,
  BillingSettings,
  BillingListMeta,
  BillingListParams,
  TopupInitPayload,
  PlanPurchasePayload,
  PaymentInitResult,
  PaymentStatus,
  PlansResponse,
  CurrentPlanResponse,
  CreditBalanceResponse,
  LedgerResponse,
  CreditPacksResponse,
  TopupsResponse,
  TopupInitResponse,
  TopupVerifyResponse,
  PlanPurchaseInitResponse,
  PlanPurchaseVerifyResponse,
  PlanPurchasesResponse,
  BillingSettingsResponse,
} from '@/types/billing.types';

const BASE = '/vendor';

// Reuses the products/tickets service query-string convention: drop empty values.
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// Docs document `_id`, but the live API may return `id`. Normalize so the rest
// of the app can rely on `_id` being present.
function normalizeId<T extends { _id?: string; id?: string }>(item: T): T {
  return { ...item, _id: item._id ?? item.id ?? '' };
}

// ─── Plans ──────────────────────────────────────────────────────────────────────

export async function fetchPlans(): Promise<PricingPlan[]> {
  const res = await api.get<PlansResponse>(`${BASE}/plans`);
  return res.data.map(normalizeId);
}

export async function fetchCurrentPlan(): Promise<CurrentPlanData> {
  const res = await api.get<CurrentPlanResponse>(`${BASE}/plan`);
  return res.data;
}

export async function fetchPlanPurchases(
  params: BillingListParams = {},
): Promise<{ data: PlanPurchase[]; meta: BillingListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<PlanPurchasesResponse>(`${BASE}/plan-purchases${qs}`);
  return { data: res.data.map(normalizeId), meta: res.meta };
}

// ─── Credit wallet ────────────────────────────────────────────────────────────

export async function fetchCreditBalance(): Promise<number> {
  const res = await api.get<CreditBalanceResponse>(`${BASE}/credits`);
  return res.data.balance;
}

export async function fetchLedger(
  params: BillingListParams = {},
): Promise<{ data: CreditTransaction[]; meta: BillingListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<LedgerResponse>(`${BASE}/credits/ledger${qs}`);
  return { data: res.data.map(normalizeId), meta: res.meta };
}

export async function fetchCreditPacks(): Promise<CreditPack[]> {
  const res = await api.get<CreditPacksResponse>(`${BASE}/credits/packs`);
  return res.data;
}

export async function fetchTopups(
  params: BillingListParams = {},
): Promise<{ data: CreditTopup[]; meta: BillingListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<TopupsResponse>(`${BASE}/credits/topups${qs}`);
  return { data: res.data.map(normalizeId), meta: res.meta };
}

// ─── Billing settings ───────────────────────────────────────────────────────────

export async function fetchBillingSettings(): Promise<BillingSettings> {
  const res = await api.get<BillingSettingsResponse>(`${BASE}/settings`);
  return res.data;
}

export async function updateBillingSettings(
  notifyDaysBeforeExpiry: number,
): Promise<BillingSettings> {
  const res = await api.patch<BillingSettingsResponse>(`${BASE}/settings`, {
    notifyDaysBeforeExpiry,
  });
  return res.data;
}

// ─── Gateway-agnostic payment flows ─────────────────────────────────────────────
// Both top-up and plan purchase share an identical initiate→poll-verify lifecycle.
// These wrappers normalize the two endpoints to a single { id, status, instructions }
// shape so PaymentDialog can drive either without knowing which it is.

export async function initiateTopup(payload: TopupInitPayload): Promise<PaymentInitResult> {
  const res = await api.post<TopupInitResponse>(`${BASE}/credits/topups`, payload);
  const topup = normalizeId(res.data.topup);
  return { id: topup._id, status: topup.status, instructions: res.data.instructions };
}

export async function verifyTopup(id: string): Promise<{ status: PaymentStatus }> {
  const res = await api.post<TopupVerifyResponse>(`${BASE}/credits/topups/${id}/verify`);
  return { status: res.data.status };
}

export async function initiatePlanPurchase(
  planId: string,
  payload: PlanPurchasePayload,
): Promise<PaymentInitResult> {
  const res = await api.post<PlanPurchaseInitResponse>(`${BASE}/plans/${planId}/purchase`, payload);
  const purchase = normalizeId(res.data.purchase);
  return { id: purchase._id, status: purchase.status, instructions: res.data.instructions };
}

export async function verifyPlanPurchase(id: string): Promise<{ status: PaymentStatus }> {
  const res = await api.post<PlanPurchaseVerifyResponse>(`${BASE}/plan-purchases/${id}/verify`);
  return { status: res.data.purchase.status };
}
