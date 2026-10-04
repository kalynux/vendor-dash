// Delivery-fee proposals, vendor view — api-doc/vendor/delivery-fee-proposals.md
// (2026-10-02). An agency, or its agent, asks for a different delivery fee on
// one shipment; the vendor pays the fee, so the vendor approves or rejects.
//
// Since 2026-10-04 (ADR-A11) the CUSTOMER answers on a customer-paid shipment —
// those rows are read-only here (`availableActions: []`) — and a change of
// delivery company on a customer-paid parcel raises a `change_agency`
// difference the vendor may `cover` at once. Shapes not in the doc were read
// from the backend's `delivery-fee-proposal.dto.ts`.
//
// Amounts are XAF "minor units" — whole francs, never divided by 100.
//
// Enums are kept open with `string & {}`: an unknown value renders read-only
// with neutral copy instead of breaking the order screen.

export type DeliveryFeeProposalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | (string & {});

export type DeliveryFeeProposalAction = 'approve' | 'reject' | 'cover' | (string & {});

/** Who answers: `vendor` (vendor-paid), `customer` (a rise on a customer-paid parcel), `none` (a cut, applied at once). */
export type DeliveryFeeProposalApprover = 'vendor' | 'customer' | 'none' | (string & {});

/** `agency` (the agency or its agent asked) · `change_agency` (you moved the parcel) · `combined_request`. */
export type DeliveryFeeProposalOrigin = 'agency' | 'change_agency' | 'combined_request' | (string & {});

export interface DeliveryFeeProposer {
  /** `system` raised a `change_agency` difference. */
  role: 'agency' | 'agent' | 'system' | (string & {});
  userId: string | null;
  agentId: string | null;
}

export interface DeliveryFeeProposalEdit {
  editedBy: DeliveryFeeProposer;
  feeBefore: number;
  feeAfter: number;
  reasonBefore: string;
  reasonAfter: string;
  version: number;
  at: string;
}

export interface DeliveryFeeProposal {
  id: string;
  shipmentId: string;
  orderId: string;
  agencyId: string;
  proposedBy: DeliveryFeeProposer;
  /** 2026-10-04 — absent on older servers, which means `vendor`. */
  approver?: DeliveryFeeProposalApprover;
  /** 2026-10-04 — absent on older servers, which means `agency`. */
  origin?: DeliveryFeeProposalOrigin;
  direction?: 'increase' | 'decrease' | null;
  /** The customer approved a rise (online: the top-up it needs is on `topup`). */
  customerApproval?: { approvedAt: string; version: number } | null;
  topup?: { amount: number; status: 'awaiting_payment' | 'paid' | (string & {}); paidAt: string | null } | null;
  combinedRequestId?: string | null;
  currency: string;
  feeBefore: number;
  proposedFee: number;
  reason: string;
  status: DeliveryFeeProposalStatus;
  respondedBy: {
    role: 'vendor' | 'agency' | 'agent' | 'system' | (string & {});
    userId: string | null;
    at: string;
  } | null;
  rejectionNote: string | null;
  /** System withdrawals: `shipment_declined` | `agent_detached`. */
  withdrawalReason: string | null;
  /** Vendor-only; set once approved. `vendorAllocation*` are `null` unless the order was already paid online. */
  application: {
    feeAtApply: number;
    vendorAllocationBefore: number | null;
    vendorAllocationAfter: number | null;
    snapshotRewritten: boolean;
    /** 2026-10-04 — the customer side of a customer-paid change; `null` on a vendor-paid one. */
    customerFeeBefore?: number | null;
    customerFeeAfter?: number | null;
    customerTopupAmount?: number | null;
    customerRefundDue?: number | null;
    codCollectionAdjusted?: boolean;
    /** How much more (or less) delivery this change put on you. */
    vendorBorneDelta?: number | null;
  } | null;
  /** Starts at 1, +1 per edit. Send back the one you displayed on approve/reject. */
  version: number;
  /** Oldest first. */
  edits: DeliveryFeeProposalEdit[];
  lastEditedBy: (DeliveryFeeProposer & { at: string }) | null;
  agencyEdited: boolean;
  /** Exactly what the API will accept from you — render the buttons from this, never from `status`. */
  availableActions: DeliveryFeeProposalAction[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryFeeProposalListParams {
  status?: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  orderId?: string;
  page?: number;
  /** ≤ 100. */
  limit?: number;
}

export interface DeliveryFeeProposalListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
