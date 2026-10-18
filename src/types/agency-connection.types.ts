// Agency Connections — contract-based vendor↔agency delivery relationship.
// See api-doc/vendor/agency-connections.md.

import type { FileRef } from '@/types/file.types';
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
  /**
   * `role_closed` (2026-10-04, ADR-A10): one side closed its account and the
   * connection ended with it — `terminatedByRole` says which. For a vendor
   * that is always the agency: a vendor whose own shop closed is signed out.
   */
  reason: 'unilateral' | 'reapproval_declined' | 'role_closed';
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
  /**
   * 2026-10-18: the AGENCY's own account status (not the connection's).
   * `pending_verification` = it has not finished activating: approving is
   * still allowed, but it cannot carry physical products and never becomes
   * the default automatically. `null` = the agency record no longer exists.
   * Optional only because a backend build before that date omits it — treat
   * `undefined` as "unknown" and show nothing.
   */
  counterpartyStatus?: CounterpartyStatus | null;
  /**
   * 2026-10-18: the agency's display fields — name the row from THIS, never
   * from `/browse` or `/delivery-agencies` (both list `active` agencies only,
   * so a row for one still activating would go nameless). `null` = the agency
   * record no longer exists; optional for the same reason as above.
   */
  counterpartyProfile?: CounterpartyProfile | null;
  createdAt: string;
  updatedAt: string;
}

export type CounterpartyStatus = 'active' | 'pending_verification' | 'inactive';

export interface CounterpartyProfile {
  /** The agency's Magazin name — `''` when it has no Magazin yet. */
  businessName: string;
  displayName: string | null;
  /** The Magazin logo. */
  logo: FileRef | null;
  kycVerified: boolean;
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
