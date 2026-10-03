// Delivery-fee proposals, vendor view — api-doc/vendor/delivery-fee-proposals.md
// (2026-10-02). An agency, or its agent, asks for a different delivery fee on
// one shipment; the vendor pays the fee, so the vendor approves or rejects.
//
// Amounts are XAF "minor units" — whole francs, never divided by 100.
//
// Enums are kept open with `string & {}`: an unknown value renders read-only
// with neutral copy instead of breaking the order screen.

export type DeliveryFeeProposalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | (string & {});

export type DeliveryFeeProposalAction = 'approve' | 'reject' | (string & {});

export interface DeliveryFeeProposer {
  role: 'agency' | 'agent' | (string & {});
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
