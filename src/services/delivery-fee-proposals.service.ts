import { api } from './api';
import type {
  DeliveryFeeProposal,
  DeliveryFeeProposalListMeta,
  DeliveryFeeProposalListParams,
  EditDeliveryFeeProposalInput,
  ProposeDeliveryFeeInput,
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

/**
 * Take a change-of-agency difference on yourself now (2026-10-04): the new
 * company is paid its price, the customer pays nothing more, your earnings
 * carry the difference. No body, no `version` — only offered while
 * `availableActions` has `cover`.
 */
export async function coverDeliveryFeeProposal(orderId: string, proposalId: string): Promise<void> {
  await api.post(`/vendor/orders/${orderId}/delivery-fee-proposals/${proposalId}/cover`);
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

// ─── Your own proposal (2026-10-14, ADR-A12) ─────────────────────────────────
// Only on a parcel whose delivery you pay, while it is `assigned` /
// `handing_over`. The agency answers; pickup waits for it. Like approve/reject,
// nothing reads the reply — the caller re-reads the order.

/** Propose a different fee — higher or lower — to the agency carrying this parcel. */
export async function proposeDeliveryFee(
  orderId: string,
  shipmentId: string,
  input: ProposeDeliveryFeeInput,
): Promise<void> {
  await api.post(`/vendor/orders/${orderId}/shipments/${shipmentId}/delivery-fee-proposals`, input);
}

/** Change your proposal while the agency has not answered. Send only what changed. */
export async function editDeliveryFeeProposal(
  orderId: string,
  proposalId: string,
  input: EditDeliveryFeeProposalInput,
): Promise<void> {
  await api.patch(`/vendor/orders/${orderId}/delivery-fee-proposals/${proposalId}`, input);
}

/** Take your proposal back: the fee stays and the parcel can be picked up. */
export async function withdrawDeliveryFeeProposal(orderId: string, proposalId: string): Promise<void> {
  await api.post(`/vendor/orders/${orderId}/delivery-fee-proposals/${proposalId}/withdraw`);
}
