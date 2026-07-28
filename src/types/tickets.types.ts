// ─── Vendor Tickets — types ───────────────────────────────────────────────────
// Shapes derived strictly from api-doc/vendor/tickets.md and
// api-doc/ticket_types.txt. Responses are enriched: every *_id reference is
// resolved into a ready-to-render actor/entity summary alongside the raw id.

import type { FileRef } from '@/types/file.types';

// ─── Enums / Union types ──────────────────────────────────────────────────────

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_admin'
  | 'waiting_on_vendor'
  | 'waiting_on_customer'
  | 'waiting_on_agency'
  | 'waiting_on_agent'
  | 'resolved'
  | 'closed';

/**
 * Stored ticket priority. Admin-influenced and lockable. The backend default on
 * creation is `normal`; the updatable enum is low/medium/high/urgent.
 */
export type TicketPriority = 'normal' | 'low' | 'medium' | 'high' | 'urgent';

/** Priorities a vendor may set via PATCH /priority. */
export type UpdatablePriority = 'low' | 'medium' | 'high' | 'urgent';

/** Vendor-supplied importance at creation time. Distinct from `priority`. */
export type TicketImportance = 'low' | 'medium' | 'high' | 'critical';

/** Entity type as sent on create (UPPERCASE), matching the `entity_type` echoed back in responses. */
export type TicketEntityType = 'ORDER' | 'PRODUCT' | 'BOOKING' | 'ACCOUNT' | 'OTHER';

/**
 * Authoritative ticket-type identifiers from api-doc/ticket_types.txt — the
 * values the API actually stores and returns (e.g. `PAYMENT_ISSUE`).
 */
export type TicketType =
  | 'GENERAL_SUPPORT' | 'ACCOUNT_ACCESS' | 'ACCOUNT_VERIFICATION' | 'PROFILE_UPDATE' | 'SECURITY_ISSUE'
  | 'ORDER_ISSUE' | 'ORDER_CANCELLATION' | 'ORDER_REFUND' | 'ORDER_DISPUTE' | 'ORDER_FULFILLMENT'
  | 'PAYMENT_ISSUE' | 'PAYMENT_FAILED' | 'PAYMENT_CONFIRMATION' | 'CHARGEBACK' | 'INVOICE_REQUEST'
  | 'PAYOUT_REQUEST' | 'PAYOUT_DELAY' | 'PAYOUT_DISPUTE' | 'COMMISSION_QUESTION'
  | 'BOOKING_ISSUE' | 'BOOKING_CANCELLATION' | 'BOOKING_RESCHEDULE' | 'AVAILABILITY_PROBLEM'
  | 'PRODUCT_ISSUE' | 'INVENTORY_PROBLEM' | 'PRICING_ISSUE' | 'VARIANT_ISSUE'
  | 'SHIPPING_ISSUE' | 'DELIVERY_DELAY' | 'DELIVERY_CONFIRMATION' | 'ADDRESS_CHANGE'
  | 'TECHNICAL_ISSUE' | 'BUG_REPORT' | 'INTEGRATION_ISSUE' | 'API_ACCESS'
  | 'POLICY_QUESTION' | 'COMPLIANCE' | 'LEGAL_REQUEST'
  | 'OTHER';

export type TicketActorRole = 'admin' | 'agent' | 'vendor' | 'customer' | 'agency';

/** Note/attachment visibility as returned by the API (lowercase). */
export type NoteVisibility = 'public' | 'private';

/** Visibility as accepted by create endpoints (uppercase). */
export type VisibilityInput = 'PUBLIC' | 'PRIVATE';

// ─── Enriched reference summaries ─────────────────────────────────────────────

/** Ready-to-render person summary attached to actor references. */
export interface TicketActor {
  user_id: string;
  role: TicketActorRole;
  name: string;
  /**
   * Profile photo / logo as a resolved file object (`{ id, key, url, … }`, the same
   * shape product images use), or `null` when unset / the reference can't be
   * resolved. (Previously a bare `avatar_url` string.)
   */
  avatar: FileRef | null;
}

/** Display-ready summary of the related entity (order/product/booking/…). */
export interface TicketEntityRef {
  type: string; // uppercase, e.g. "ORDER"
  id: string;
  label: string; // e.g. "Order ORD-2026-001003"
  reference: string; // human reference (order number, slug) or id fallback
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

/** Shape returned by the list endpoint (GET /vendor/tickets). */
export interface ApiTicketListItem {
  /** Canonical id; service normalizes `_id ?? id`. */
  _id: string;
  id?: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  importance?: TicketImportance;
  type: TicketType;
  entity_type: string;
  entity_id: string;
  entity: TicketEntityRef | null;
  created_by_user_id: string;
  created_by_role: TicketActorRole;
  created_by: TicketActor | null;
  assigned_to_role: TicketActorRole | null;
  assigned_to: TicketActor | null;
  assigned_admin_id: string | null;
  assigned_admin: TicketActor | null;
  priority_locked: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Full ticket returned by GET /vendor/tickets/:id. */
export interface ApiTicketDetail extends ApiTicketListItem {
  description: string;
  importance: TicketImportance;
  followers: TicketActor[];
}

/** Partial ticket returned by the PATCH/close mutation endpoints. */
export type ApiTicketMutation = Partial<ApiTicketDetail> & { _id?: string; id?: string };

export interface ApiTicketNote {
  _id: string;
  ticket_id: string;
  content: string;
  visibility: NoteVisibility;
  is_system_note: boolean;
  author_user_id: string;
  author_role: TicketActorRole;
  author: TicketActor | null;
  visible_to_user_ids: string[];
  created_at: string;
}

export interface ApiTicketAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedBy: string;
  uploadedByRole: TicketActorRole;
  uploadedByActor: TicketActor | null;
  createdAt: string;
}

// ─── Response Envelopes ───────────────────────────────────────────────────────

export interface TicketListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TicketListResponse {
  success: boolean;
  data: ApiTicketListItem[];
  pagination: TicketListMeta;
}

export interface TicketDetailResponse {
  success: boolean;
  data: ApiTicketDetail;
}

export interface TicketMutationResponse {
  success: boolean;
  data: ApiTicketMutation;
  message?: string;
}

export interface CreateTicketResponse {
  success: boolean;
  data: ApiTicketDetail;
  message?: string;
}

export interface NotesListResponse {
  success: boolean;
  data: ApiTicketNote[];
}

export interface NoteMutationResponse {
  success: boolean;
  data: ApiTicketNote;
  message?: string;
}

export interface AttachmentsListResponse {
  success: boolean;
  data: ApiTicketAttachment[];
}

export interface AttachmentMutationResponse {
  success: boolean;
  data: ApiTicketAttachment;
}

// ─── Write Payloads ───────────────────────────────────────────────────────────

export interface CreateTicketPayload {
  subject: string;
  description: string;
  type: TicketType;
  importance: TicketImportance;
  entityType: TicketEntityType;
  /** Optional for `OTHER` (defaults server-side to the requester's own id); required otherwise. */
  entityId?: string;
  /** Required only for `ORDER` tickets when the support policy lists `tracking_number`. Max 120. */
  trackingNumber?: string;
  /** File-reference ids. Required for `ORDER`/`PRODUCT` tickets when the policy lists `product_photo_video`. Max 5. */
  attachments?: string[];
}

export interface UpdateTicketPayload {
  subject?: string;
  description?: string;
}

export interface CreateNotePayload {
  content: string;
  visibility?: NoteVisibility;
  visibleToUserIds?: string[];
}

/** Links an already-uploaded file (by id) to a ticket as an attachment. */
export interface CreateAttachmentPayload {
  fileId: string;
  visibility?: VisibilityInput;
  visibleToUserIds?: string[];
}

// ─── Entity reference (create-ticket pickers) ─────────────────────────────────
// Cheap, role-scoped lists for populating entityId + trackingNumber, from
// GET /vendor/tickets/reference/orders and /reference/products.

/** A shipment on a reference order — one agency + tracking number per entry. */
export interface TicketReferenceShipment {
  shipmentId: string;
  agencyId: string | null;
  agencyName: string | null;
  agentId: string | null;
  trackingNumber: string | null;
  status: string;
}

export interface TicketReferenceOrder {
  id: string;
  orderNumber: string;
  orderType: 'physical' | 'digital';
  fulfillmentStatus: string;
  createdAt: string;
  customerName: string | null;
  customerAvatarUrl: string | null;
  shipments: TicketReferenceShipment[];
}

export interface TicketReferenceProduct {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  tags: string[];
  firstFileUrl: string | null;
}

export interface TicketReferencePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TicketReferenceOrdersResponse {
  success: boolean;
  data: TicketReferenceOrder[];
  pagination: TicketReferencePagination;
}

export interface TicketReferenceProductsResponse {
  success: boolean;
  data: TicketReferenceProduct[];
  pagination: TicketReferencePagination;
}

export interface TicketReferenceQueryParams {
  page?: number;
  limit?: number;
  q?: string;
}

/** A tracking number offered for an order, with its shipment context for labelling. */
export interface OrderTrackingOption {
  trackingNumber: string;
  agencyName?: string | null;
  deliveryStatus?: string;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface TicketsQueryParams {
  status?: TicketStatus;
  priority?: UpdatablePriority;
  type?: TicketType;
  entityType?: TicketEntityType;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}
