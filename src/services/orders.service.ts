import { api } from './api';
import { ApiError } from '@/types/api';
import type { Order, OrderItem, Customer, OrderTimelineEvent, Entitlement, TimelineEventType, DisputeHold } from '@/types';

// ─── Error Handling ────────────────────────────────────────────────────────────

/**
 * Friendly, user-facing labels for known order/entitlement error codes.
 * Falls back to the backend `err.message` for any unmapped code (see
 * getOrderErrorMessage). Mirrors the REFUND_ERROR_LABELS pattern.
 */
export const ORDER_ERROR_LABELS: Record<string, string> = {
  // status transitions (PATCH /vendor/orders/:id/status)
  ORDER_PAYMENT_REQUIRED: "This order can't be processed because its payment hasn't been completed.",
  ORDER_PAYMENT_FAILED_STATE: "Payment for this order failed, so it can't be moved forward.",
  ORDER_TERMINAL_STATE: 'This order is in a final state and can no longer be updated.',
  ORDER_INVALID_TRANSITION: "That status change isn't allowed from the order's current status.",
  ORDER_WRONG_TYPE: "That action doesn't apply to this order's type.",
  ORDER_DISPUTE_HOLD: "This order is frozen by an open payment dispute and can't be advanced until it settles.",
  ORDER_NOT_FOUND: 'This order could no longer be found.',
  ORDER_DELIVERY_AGENCY_NOT_FOUND: 'No delivery agency is assigned to this order.',
  // entitlements (revoke/restore)
  DIGITAL_ENTITLEMENT_NOT_FOUND: 'This entitlement could no longer be found.',
  DIGITAL_ENTITLEMENT_ALREADY_REVOKED: 'This entitlement has already been revoked.',
  DIGITAL_ENTITLEMENT_NOT_REVOKED: 'This entitlement is not currently revoked.',
  DIGITAL_ENTITLEMENT_EXPIRED: "This entitlement has expired and can't be restored.",
  DIGITAL_ENTITLEMENT_UNAUTHORIZED: "You don't have access to this entitlement.",
};

/** Resolve a user-facing message for any error thrown by an order API call. */
export function getOrderErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return ORDER_ERROR_LABELS[err.code] ?? err.message;
  return 'Something went wrong. Please try again.';
}

// ─── API Response Types ────────────────────────────────────────────────────────

/** Raw `dispute_hold` shape on an order (snake_case from the API). */
interface ApiDisputeHold {
  active: boolean;
  disputed_at?: string | null;
  resolved_at?: string | null;
  gateway_dispute_id?: string | null;
  reason?: string | null;
}

interface ApiOrderListItem {
  id: string;
  orderNumber: string;
  orderType: 'physical' | 'digital';
  fulfillmentStatus: string;
  paymentStatus: string;
  dispute_hold?: ApiDisputeHold | null;
  customer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

interface ApiOrderDetail {
  id: string;
  orderNumber: string;
  orderType: 'physical' | 'digital';
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentIntentId?: string;
  dispute_hold?: ApiDisputeHold | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    orderCount: number;
    totalSpent: number;
  } | null;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    variantId?: string;
    title: string;
    variantTitle?: string;
    sku: string;
    optionsSnapshot?: string;
    quantity: number;
    price: number;
    subtotal: number;
    currency: string;
  }>;
  priceBreakdown: {
    base: number;
    tax: number;
    discount: number;
    shipping: number;
    total: number;
  };
  totalAmount: number;
  currency: string;
  delivery?: {
    agencyId?: string;
    agencyName?: string;
    agencyPhone?: string;
    deliveryStatus?: string;
    shipmentId?: string;
    agent?: {
      id: string;
      name: string;
      phone?: string;
      avatarUrl?: string;
    } | null;
  } | null;
  notes?: Array<{
    id: string;
    message: string;
    authorId: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface ApiTimelineEvent {
  _id: string;
  orderId: string;
  eventType: TimelineEventType;
  oldValue?: string | null;
  newValue?: string | null;
  noteId?: string | null;
  description?: string | null;
  actor: {
    type: string;
    id: string | null;
    name: string | null;
  };
  created_at: string;
}

interface ApiEntitlement {
  id: string;
  orderItemId: string;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantName?: string | null;
  assetId: string;
  assetName: string;
  customerId: string;
  downloadsUsed: number;
  maxDownloads: number | null;
  downloadsRemaining: number | 'unlimited';
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastDownloadAt: string | null;
  isActive: boolean;
  isRevoked: boolean;
  isExpired: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface OrdersListResponse {
  success: boolean;
  data: ApiOrderListItem[];
  meta: PaginationMeta;
}

interface OrderDetailResponse {
  success: boolean;
  data: ApiOrderDetail;
}

interface OrderTimelineResponse {
  success: boolean;
  data: ApiTimelineEvent[];
  meta: { total: number; page: number; limit: number; pages: number };
}

interface EntitlementsResponse {
  success: boolean;
  data: ApiEntitlement[];
  meta: { count: number; activeCount: number; revokedCount: number; expiredCount: number };
}

interface UpdateStatusResponse {
  success: boolean;
  data: ApiOrderDetail;
  message: string;
}

interface AddNoteResponse {
  success: boolean;
  data: { id: string; message: string; authorId: string; createdAt: string };
  message: string;
}

interface RevokeEntitlementResponse {
  success: boolean;
  data: { id: string; revokedAt: string; reason: string; message: string };
  message: string;
}

interface RestoreEntitlementResponse {
  success: boolean;
  data: { id: string; restoredAt: string; reason: string; message: string };
  message: string;
}

// ─── Query Params ──────────────────────────────────────────────────────────────

export interface OrdersQueryParams {
  status?: string;
  paymentStatus?: string;
  orderType?: 'physical' | 'digital';
  /** Scope the list to a single customer (used by the Customers tab). */
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'updated_at' | 'total_amount';
  sortOrder?: 'asc' | 'desc';
}

// ─── Adapters ──────────────────────────────────────────────────────────────────

function adaptPaymentStatus(status: string): Order['paymentStatus'] {
  if (status === 'AWAITING_PAYMENT') return 'pending';
  const valid: Order['paymentStatus'][] = ['pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'disputed'];
  return (valid as string[]).includes(status) ? (status as Order['paymentStatus']) : 'pending';
}

function adaptFulfillmentStatus(status: string): Order['status'] {
  const valid: Order['status'][] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'fulfilled', 'cancelled', 'refunded', 'returned'];
  return (valid as string[]).includes(status) ? (status as Order['status']) : 'pending';
}

function adaptDisputeHold(hold?: ApiDisputeHold | null): DisputeHold | undefined {
  if (!hold) return undefined;
  return {
    active: !!hold.active,
    disputedAt: hold.disputed_at ?? null,
    resolvedAt: hold.resolved_at ?? null,
    gatewayDisputeId: hold.gateway_dispute_id ?? null,
    reason: hold.reason ?? null,
  };
}

/**
 * Whether an order is frozen by an open payment dispute and cannot be advanced.
 * Treats an explicit active `dispute_hold` OR a `disputed` payment status as frozen,
 * so the UI stays safe even when a list item omits the full `dispute_hold` object.
 */
export function isOrderFrozen(order: Order): boolean {
  return order.disputeHold?.active === true || order.paymentStatus === 'disputed';
}

function adaptListItemToOrder(item: ApiOrderListItem): Order {
  return {
    id: item.id,
    orderNumber: item.orderNumber,
    orderType: item.orderType,
    status: adaptFulfillmentStatus(item.fulfillmentStatus),
    paymentStatus: adaptPaymentStatus(item.paymentStatus),
    disputeHold: adaptDisputeHold(item.dispute_hold),
    fulfillmentStatus: 'unfulfilled',
    total: item.total,
    subtotal: item.subtotal,
    tax: item.tax,
    shipping: item.shipping,
    discount: 0,
    currency: item.currency,
    customer: {
      id: item.customer.id,
      name: item.customer.name,
      email: item.customer.email,
      avatar: item.customer.avatar,
      addresses: [],
      orderCount: 0,
      totalSpent: 0,
    },
    items: Array.from({ length: item.itemCount }, (_, i) => ({
      id: `${item.id}-item-${i}`,
      productId: '',
      name: '',
      sku: '',
      quantity: 1,
      price: 0,
      total: 0,
    })),
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    tags: [],
    timeline: [],
    riskLevel: 'low',
  };
}

function adaptDetailToOrder(detail: ApiOrderDetail): Order {
  const items: OrderItem[] = detail.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    name: item.variantTitle ? `${item.title} — ${item.variantTitle}` : item.title,
    sku: item.sku,
    quantity: item.quantity,
    price: item.price,
    total: item.subtotal,
  }));

  const customer: Customer = {
    id: detail.customer?.id ?? '',
    name: detail.customer?.name ?? '',
    email: detail.customer?.email ?? '',
    phone: detail.customer?.phone,
    avatar: detail.customer?.avatar,
    addresses: [],
    orderCount: detail.customer?.orderCount ?? 0,
    totalSpent: detail.customer?.totalSpent ?? 0,
  };

  if (detail.shippingAddress) {
    const nameParts = (detail.customer?.name ?? '').split(' ');
    const address = {
      id: 'shipping',
      firstName: nameParts[0] ?? '',
      lastName: nameParts.slice(1).join(' '),
      address1: detail.shippingAddress.street,
      city: detail.shippingAddress.city,
      province: detail.shippingAddress.state,
      country: detail.shippingAddress.country,
      zip: '',
    };
    customer.addresses = [address];
    customer.defaultAddress = address;
  }

  return {
    id: detail.id,
    orderNumber: detail.orderNumber,
    orderType: detail.orderType,
    status: adaptFulfillmentStatus(detail.fulfillmentStatus),
    paymentStatus: adaptPaymentStatus(detail.paymentStatus),
    disputeHold: adaptDisputeHold(detail.dispute_hold),
    fulfillmentStatus: 'unfulfilled',
    total: detail.totalAmount,
    subtotal: detail.priceBreakdown.base,
    tax: detail.priceBreakdown.tax,
    shipping: detail.priceBreakdown.shipping,
    discount: detail.priceBreakdown.discount,
    currency: detail.currency,
    customer,
    items,
    deliveryAgency: detail.delivery?.agencyName
      ? { name: detail.delivery.agencyName, address: detail.delivery.agencyPhone ?? '' }
      : undefined,
    assignedAgent: detail.delivery?.agent
      ? { name: detail.delivery.agent.name }
      : undefined,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    tags: [],
    timeline: [],
    riskLevel: 'low',
  };
}

function adaptTimelineEvent(event: ApiTimelineEvent): OrderTimelineEvent {
  let message: string;
  if (event.eventType === 'fulfillment.updated' && event.oldValue && event.newValue) {
    message = `Fulfillment status changed from "${event.oldValue}" to "${event.newValue}"`;
  } else {
    const labels: Record<string, string> = {
      'order.created': 'Order was placed',
      'payment.updated': 'Payment status updated',
      'delivery.agency_updated': 'Delivery agency assigned',
      'note.added': 'Internal note added',
      'entitlement.revoked': 'Digital entitlement revoked',
      'entitlement.restored': 'Digital entitlement restored',
      'system.action': 'Automated system action',
    };
    message = labels[event.eventType] ?? event.eventType.replace(/\./g, ' ');
  }

  return {
    id: event._id,
    // type: 'order_placed',
    type: event.eventType,
    message,
    description: event.description ?? null,
    createdAt: event.created_at,
    actor: event.actor.name ?? 'System',
    noteId: event.noteId ?? null,
  };
}

function adaptEntitlement(e: ApiEntitlement): Entitlement {
  return {
    id: e.id,
    orderItemId: e.orderItemId,
    productId: e.productId,
    productTitle: e.productTitle,
    variantId: e.variantId,
    variantName: e.variantName ?? null,
    assetId: e.assetId,
    assetName: e.assetName,
    customerId: e.customerId,
    downloadsUsed: e.downloadsUsed,
    maxDownloads: e.maxDownloads,
    downloadsRemaining: e.downloadsRemaining,
    grantedAt: e.grantedAt,
    expiresAt: e.expiresAt,
    revokedAt: e.revokedAt,
    lastDownloadAt: e.lastDownloadAt,
    isActive: e.isActive,
    isRevoked: e.isRevoked,
    isExpired: e.isExpired,
  };
}

// ─── Service Functions ─────────────────────────────────────────────────────────

export async function fetchOrders(
  params: OrdersQueryParams = {},
): Promise<{ data: Order[]; meta: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.paymentStatus) query.set('paymentStatus', params.paymentStatus);
  if (params.orderType) query.set('orderType', params.orderType);
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const qs = query.toString();
  const res = await api.get<OrdersListResponse>(`/vendor/orders${qs ? `?${qs}` : ''}`);
  return {
    data: res.data.map(adaptListItemToOrder),
    meta: res.meta,
  };
}

export async function fetchOrderById(id: string): Promise<Order> {
  const detailRes = await api.get<OrderDetailResponse>(`/vendor/orders/${id}`);
  const detail = detailRes.data;

  const [timelineRes, entitlementsRes] = await Promise.all([
    api.get<OrderTimelineResponse>(`/vendor/orders/${id}/timeline`).catch(() => null),
    detail.orderType === 'digital'
      ? api.get<EntitlementsResponse>(`/vendor/orders/${id}/entitlements`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const order = adaptDetailToOrder(detail);
  if (timelineRes) order.timeline = timelineRes.data.map(adaptTimelineEvent);
  if (entitlementsRes) order.entitlements = entitlementsRes.data.map(adaptEntitlement);
  return order;
}

export async function updateOrderStatus(id: string, status: string): Promise<Order> {
  const res = await api.patch<UpdateStatusResponse>(`/vendor/orders/${id}/status`, { status });
  return adaptDetailToOrder(res.data);
}

export async function addNote(orderId: string, message: string): Promise<AddNoteResponse['data']> {
  const res = await api.post<AddNoteResponse>(`/vendor/orders/${orderId}/notes`, { message });
  return res.data;
}

export async function fetchNote(orderId: string, noteId: string): Promise<string> {
  const res = await api.get<{ success: boolean; data: { id: string; orderId: string; message: string; authorId: string; createdAt: string } }>(
    `/vendor/orders/${orderId}/notes/${noteId}`,
  );
  return res.data.message;
}

export async function revokeEntitlement(
  entitlementId: string,
  reason: string,
): Promise<RevokeEntitlementResponse['data']> {
  const res = await api.post<RevokeEntitlementResponse>(
    `/vendor/entitlements/${entitlementId}/revoke`,
    { reason },
  );
  return res.data;
}

export async function restoreEntitlement(
  entitlementId: string,
  reason: string,
): Promise<RestoreEntitlementResponse['data']> {
  const res = await api.post<RestoreEntitlementResponse>(
    `/vendor/entitlements/${entitlementId}/restore`,
    { reason },
  );
  return res.data;
}
