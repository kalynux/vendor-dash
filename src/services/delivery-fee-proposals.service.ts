import { api } from './api';
import type {
  DeliveryFeeProposal,
  DeliveryFeeProposalListMeta,
  DeliveryFeeProposalListParams,
} from '@/types/delivery-fee-proposals.types';

// api-doc/vendor/delivery-fee-proposals.md (2026-10-02).

interface ProposalListResponse {
  success: boolean;
  data: DeliveryFeeProposal[];
  meta: DeliveryFeeProposalListMeta;
}

interface ProposalsResponse {
  success: boolean;
  data: DeliveryFeeProposal[];
}

/** The inbox across orders. Every status unless `status` is given. */
export async function listDeliveryFeeProposals(
  params: DeliveryFeeProposalListParams = {},
): Promise<{ data: DeliveryFeeProposal[]; meta: DeliveryFeeProposalListMeta }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.orderId) query.set('orderId', params.orderId);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  const res = await api.get<ProposalListResponse>(`/vendor/delivery-fee-proposals${qs ? `?${qs}` : ''}`);
  return { data: res.data, meta: res.meta };
}

/** One order's proposals, newest first. */
export async function fetchOrderDeliveryFeeProposals(orderId: string): Promise<DeliveryFeeProposal[]> {
  const res = await api.get<ProposalsResponse>(`/vendor/orders/${orderId}/delivery-fee-proposals`);
  return res.data;
}

// The approve/reject answer body is not documented beyond success, so nothing
// reads it: the caller re-reads the order, which carries the updated proposal.

/**
 * Accept the proposed fee. `version` must be the one the vendor was shown —
 * never re-read it just before sending, or a changed figure gets approved
 * unseen. A stale one is refused with `409 DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH`.
 */
export async function approveDeliveryFeeProposal(
  orderId: string,
  proposalId: string,
  version: number,
): Promise<void> {
  await api.post(`/vendor/orders/${orderId}/delivery-fee-proposals/${proposalId}/approve`, { version });
}

/** Keep the original fee. Same `version` rule as approve; `note` ≤ 500 chars. */
export async function rejectDeliveryFeeProposal(
  orderId: string,
  proposalId: string,
  version: number,
  note?: string,
): Promise<void> {
  await api.post(
    `/vendor/orders/${orderId}/delivery-fee-proposals/${proposalId}/reject`,
    note ? { version, note } : { version },
  );
}
