// Agency Connections — contract-based vendor↔agency delivery relationship.
// See api-doc/vendor/agency-connections.md.

import type { VendorAgencyListItemDto } from '@/types/product.types';

export type ConnectionStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'withdrawn'
  | 'paused_reapproval'
  | 'terminated';

export type ConnectionParty = 'vendor' | 'agency';

export interface ConnectionRejectionInfo {
  reason: string | null;
  rejectedByRole: ConnectionParty;
  rejectedAt: string;
}

export interface ConnectionWithdrawalInfo {
  withdrawnByRole: ConnectionParty;
  withdrawnAt: string;
}

export interface ConnectionTerminationInfo {
  terminatedByRole: ConnectionParty;
  terminatedAt: string;
  reason: 'unilateral' | 'reapproval_declined';
  note: string | null;
}

export interface ConnectionDto {
  id: string;
  vendorId: string;
  agencyId: string;
  status: ConnectionStatus;
  requesterRole: ConnectionParty;
  requestedByUserId: string;
  requestedAt: string;
  respondedByUserId: string | null;
  respondedAt: string | null;
  reapprovalRequiredFrom: ConnectionParty | null;
  pausedAt: string | null;
  pausedReason: 'vendor_policy_changed' | 'agency_policy_changed' | null;
  rejection: ConnectionRejectionInfo | null;
  withdrawal: ConnectionWithdrawalInfo | null;
  termination: ConnectionTerminationInfo | null;
  createdAt: string;
  updatedAt: string;
}

/** Thin connection annotation nested on each `GET .../browse` agency result. */
export interface ConnectionSummary {
  id: string;
  status: ConnectionStatus;
}

/** An agency listing item annotated with the vendor's current connection state (if any). */
export interface AgencyBrowseItemDto extends VendorAgencyListItemDto {
  connection: ConnectionSummary | null;
}

export interface AgencyConnectionListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgencyBrowseQueryParams {
  search?: string;
  region?: string;
  hq_city?: string;
  storage_based?: boolean;
  pickup_based?: boolean;
  returns_payer?: 'vendor' | 'agency' | 'customer';
  min_claim_deadline_days?: number;
  page?: number;
  limit?: number;
}

export interface ListConnectionsParams {
  status?: ConnectionStatus;
  page?: number;
  limit?: number;
}

export interface GetAgencyBrowseResponse {
  success: true;
  data: AgencyBrowseItemDto[];
  meta: AgencyConnectionListMeta;
}

export interface ListAgencyConnectionsResponse {
  success: true;
  data: ConnectionDto[];
  meta: AgencyConnectionListMeta;
}

export interface AgencyConnectionResponse {
  success: true;
  data: ConnectionDto;
}
