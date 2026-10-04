import type { TranslationKey } from '@/i18n';
import type { CodLimitForce, CodLimitHold } from './cod-limits.types';
import type { DeliveryFeeProposal } from './delivery-fee-proposals.types';

// Product Types - Legacy (for backward compatibility)
export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  costPerItem?: number;
  images: string[];
  status: 'active' | 'draft' | 'archived';
  inventory: Inventory;
  variants: ProductVariant[];
  vendor: string;
  category: string;
  tags: string[];
  seo: SEO;
  createdAt: string;
  updatedAt: string;
  productType?: ProductType;
  weight?: number;
  weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft';
  requiresShipping?: boolean;
  digitalAssets?: DigitalAsset[];
  downloadLimit?: number;
  downloadExpiryDays?: number;
  previewEnabled?: boolean;
  duration?: number;
  durationUnit?: 'minute' | 'hour' | 'day';
  locationType?: 'virtual' | 'physical' | 'both';
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  variantStrategy?: 'single' | 'variant';
  bookingSettings?: ServiceBookingSettings;
  availability?: ServiceAvailability;
  staffIds?: string[];
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  price: number;
  inventory: number;
  options: { name: string; value: string }[];
}

export interface Inventory {
  quantity: number;
  tracked: boolean;
  lowStockThreshold: number;
}

export interface SEO {
  title: string;
  description: string;
}

export type ProductType = 'physical' | 'digital' | 'service';

export interface DigitalAsset {
  id: string;
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  downloadCount: number;
}

// Order Types
export type PaymentMethod = 'online' | 'cash_on_delivery';

export interface Order {
  id: string;
  orderNumber: string;
  orderType: 'physical' | 'digital';
  customer: Customer;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  tags: string[];
  timeline: OrderTimelineEvent[];
  riskLevel: 'low' | 'medium' | 'high';
  /** Order-level shipment overview — one entry per agency/shipment handling the order. `null`/absent for digital orders. */
  deliveries?: OrderItemDelivery[] | null;
  /** Merged, per-agency shipment status history, sorted chronologically. Empty for digital orders. */
  deliveryTimeline?: OrderDeliveryTimelineEntry[];
  entitlements?: Entitlement[];
  /**
   * Set when a card payment is under dispute (chargeback). While `active` is true the
   * order is frozen — fulfilment status changes return `423 ORDER_DISPUTE_HOLD`.
   * Resolution is automatic via Stripe webhooks; the vendor cannot act on it.
   */
  disputeHold?: DisputeHold;
  /** List rows only (2026-10-02): a shipment of this order is held back over a COD limit. */
  codLimitHeld?: boolean;
  /** Detail only (2026-10-02): this order's delivery-fee proposals, newest first. `[]` for digital orders. */
  deliveryFeeProposals?: DeliveryFeeProposal[];
  /**
   * Who paid delivery (2026-10-04) — list rows and detail. `null` on a digital
   * order; absent on older servers. `shipping` above is what the CUSTOMER paid.
   */
  deliveryPayer?: DeliveryPayer | null;
  /** Detail only: why `deliveryPayer` is who it is. */
  deliveryPayerReason?: DeliveryPayerReason | null;
  /**
   * Detail only: the delivery fees taken out of YOUR earnings (Σ of
   * `deliveries[].deliveryFee.vendorBorne`). `null` on a digital order or before
   * any fee is priced.
   */
  vendorBorneDelivery?: number | null;
}

/** Who paid an order's (or a shipment's) delivery — api-doc/vendor/orders.md (2026-10-04). Open for forward-compat. */
export type DeliveryPayer = 'vendor' | 'customer' | (string & {});

/** `shop_always` · `shop_threshold_met` · `shop_never` · `threshold_not_met` · `cap_fallback`. */
export type DeliveryPayerReason =
  | 'shop_always'
  | 'shop_threshold_met'
  | 'shop_never'
  | 'threshold_not_met'
  | 'cap_fallback'
  | (string & {});

/** `deliveries[].deliveryFee` / `items[].delivery.deliveryFee` — one shipment's delivery money. */
export interface ShipmentDeliveryFee {
  payer: DeliveryPayer;
  /** What the agency is paid (the approved change, else the price posted at checkout); `null` while unpriced. */
  fee: number | null;
  /** What the customer paid for this shipment's delivery online. */
  customerPaid: number;
  /** What comes out of your earnings for it; `null` while unpriced. */
  vendorBorne: number | null;
}

/** Chargeback freeze marker carried on an order (mirrors the API `dispute_hold` object). */
export interface DisputeHold {
  active: boolean;
  disputedAt?: string | null;
  resolvedAt?: string | null;
  gatewayDisputeId?: string | null;
  reason?: string | null;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'partially_shipped'
  | 'shipped'
  | 'partially_delivered'
  | 'delivered'
  | 'fulfilled'
  | 'cancelled'
  | 'returned';

/** The only fulfilment statuses a vendor can set directly via PATCH — everything else is system-computed. */
export type VendorSettableStatus = 'pending' | 'processing' | 'cancelled';

/**
 * Mirrors the backend's order payment-status enum exactly (see orders.md). Note
 * `AWAITING_PAYMENT` is upper-cased on the wire — kept as-is here rather than
 * normalized, so it round-trips unchanged through the adapter.
 */
export type PaymentStatus = 'pending' | 'AWAITING_PAYMENT' | 'partially_paid' | 'paid' | 'disputed' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'restocked';

/**
 * Per-item delivery status. Kept loose (`string`) at the type level in
 * `OrderItemDelivery`/`OrderDeliveryTimelineEntry` so an unrecognized future
 * value from the API doesn't break typing — this union documents the known set.
 */
export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'agent_delivered'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'rejected'
  | 'pending_agency_reassignment';

/**
 * Per-item shipment rejection detail — set when a delivery agency **declines** the
 * item's shipment (the item then moves to `pending_agency_reassignment` and must be
 * rerouted). A `shipment.rejected` notification also fires. See orders.md.
 */
export interface DeliveryRejection {
  /**
   * Why the agency declined. Known values: `out_of_coverage_area`, `capacity_exceeded`,
   * `invalid_address`, `vendor_item_not_ready`, `other`. Kept loose (`string`) for
   * forward-compat with future reasons.
   */
  reason: string;
  /** Agency's free-text explanation. Always present when `reason` is `other`, else may be `null`. */
  note: string | null;
  rejectedAt: string;
}

/** A single shipment's delivery info — shared shape for `items[].delivery` and order-level `deliveries[]`. */
export interface OrderItemDelivery {
  agencyId?: string;
  agencyName?: string;
  /** Admin has verified the agency's business documents — shows the verified badge. */
  agencyVerified?: boolean;
  agencyPhone?: string;
  deliveryStatus?: string;
  shipmentId?: string;
  /**
   * `ACR-YYMMDD-HHMMSS-XXXXX` — the agency's acronym plus the UTC date/time the
   * shipment was created. **Platform-generated at shipment creation**, so it is
   * present from the moment the order exists, including before dispatch; nobody
   * types it and nobody can change it. `null` only on shipments predating
   * generation, hence still optional here.
   */
  trackingNumber?: string | null;
  /** This shipment's delivery money (2026-10-04); `null` before a shipment exists, absent on older servers. */
  deliveryFee?: ShipmentDeliveryFee | null;
  /** Set only on `items[].delivery` when the agency declined the item's shipment; `null` otherwise. */
  rejection?: DeliveryRejection | null;
  agent?: {
    id: string;
    name: string;
    phone?: string;
    avatarUrl?: string;
    /** Admin has verified the agent's identity — shows the verified badge. */
    verified?: boolean;
  } | null;
  /** Auto-dispatch held this COD shipment back over a limit; only the vendor's dispatch moves it (2026-10-02). */
  codLimitHold?: CodLimitHold | null;
  /** The shipment was dispatched over a COD limit on purpose — an audit line (2026-10-02). */
  codLimitForce?: CodLimitForce | null;
}

/** One entry in the merged, per-agency shipment status history (`Order.deliveryTimeline`). */
export interface OrderDeliveryTimelineEntry {
  shipmentId: string;
  agencyId: string;
  agencyName: string;
  agencyVerified?: boolean;
  status: string;
  changedAt: string;
  changedByRole: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
  productType?: ProductType;
  /** Authoritative per-item delivery info — an order can be split across several agencies (one per item). `undefined` for digital items. */
  delivery?: OrderItemDelivery;
}

export interface Entitlement {
  id: string;
  orderItemId: string;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantName: string | null; // which digital format was purchased
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
  // NOTE: revokeReason is not returned by the entitlements list endpoint.
  // Request backend to add revokeReason: string | null to the list response.
  revokeReason?: string | null;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  avatar?: string;
  addresses: Address[];
  defaultAddress?: Address;
  orderCount: number;
  totalSpent: number;
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
}

export type TimelineEventType =
    | 'order.created'
    | 'payment.updated'
    | 'fulfillment.updated'
    | 'delivery.agency_updated'      // NEW: Phase 1 - Delivery agency assignment
    | 'note.added'
    | 'entitlement.revoked'          // NEW: Phase 2 - Digital entitlement revoked
    | 'entitlement.restored'         // NEW: Phase 2 - Digital entitlement restored
    | 'system.action';

export interface OrderTimelineEvent {
  id: string;
  type: TimelineEventType;
  /**
   * Translation key for the event line, resolved at the render site so the
   * timeline follows a language switch without a refetch. `messageFallback`
   * carries the raw event type for the codes we have no wording for yet.
   */
  messageKey: TranslationKey | null;
  messageParams?: Record<string, string>;
  messageFallback: string;
  description: string | null;
  createdAt: string;
  actor: string;
  noteId?: string | null;
}


// Analytics Types
// All fields are derived from GET /api/vendor/analytics/* (see api-doc/vendor/analytics.md).
export interface AnalyticsMetrics {
  totalSales: MetricWithChange;        // sales.grossSales
  totalOrders: MetricWithChange;       // sales.orderCount
  netRevenue: MetricWithChange;        // sales.netRevenue (gross minus every deduction)
  averageOrderValue: MetricWithChange; // sales.aov (gross / distinct orders)
}

/**
 * Sales money for a period: `dashboard.sales`, `/sales` `data.totals` and each
 * `data.daily[]` row. Figures come from the earnings records, dated the day the
 * money arrived.
 */
export interface SalesBreakdown {
  /** What customers paid: the order total (online) or the cash collected (COD). */
  grossSales: number;
  bargainFee: number;
  commission: number;
  /** `null` when a COD sale has no recorded delivery fee — show `deliveryAndCodFees`. */
  deliveryFee: number | null;
  /** `null` alongside `deliveryFee` — show `deliveryAndCodFees`. */
  codFee: number | null;
  /** Always set: delivery fee + COD fee combined. */
  deliveryAndCodFees: number;
  /** gross − bargainFee − commission − deliveryFee − codFee. */
  netRevenue: number;
  /** Distinct orders with money received in the period. */
  orderCount: number;
  /** Average gross per order. */
  aov: number;
}

/** Earnings moves outside sales and bookings (dashboard `data.adjustments`). */
export interface EarningsAdjustments {
  deliveryFeesReturned: number;
  earningsReversed: number;
}

/** Refunds paid to customers — information only; the earnings effect is `earningsReversed`. */
export interface CustomerRefunds {
  count: number;
  amount: number;
}

/**
 * A metric value plus its period-over-period delta. `change`/`changeType` are
 * computed on the frontend by comparing the current range with the immediately
 * preceding equal-length range (the backend returns absolute values only).
 */
export interface MetricWithChange {
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
}

export interface SalesDataPoint {
  date: string;
  sales: number;  // daily grossSales
  orders: number; // daily orderCount
}

/** A top-performing variant from GET /vendor/analytics/products. */
export interface TopProduct {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  /** Line value at the price actually paid (the negotiated one when bargained). */
  revenue: number;
  quantity: number;
  /** Distinct orders, not order lines. */
  orderCount: number;
}

/** Customer acquisition/retention from GET /vendor/analytics/customers. */
export interface CustomerMetrics {
  total: number;
  repeat: number;
  repeatRate: number;
}

/** Booking totals from the dashboard endpoint (data.bookings). */
export interface BookingMetrics {
  count: number;
  grossRevenue: number;
  commission: number;
  netRevenue: number;
}

// UI Types
export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export interface FilterState {
  status?: string[];
  dateRange?: DateRange;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Media/file types now live in src/types/file.types.ts (backend File Management
// Service) and are consumed via src/services/files.service.ts.

// Extended Product Types for Product Upload Flow
export interface ServiceBookingSettings {
  minAdvanceBooking: number;
  maxAdvanceBooking: number;
  minAdvanceUnit: 'minute' | 'hour' | 'day';
  maxAdvanceUnit: 'minute' | 'hour' | 'day';
  allowRescheduling: boolean;
  cancellationPolicy: 'anytime' | '24h' | '48h' | '72h' | 'custom';
  customCancellationHours?: number;
}

export interface ServiceAvailability {
  timezone: string;
  schedule: WeeklySchedule;
  exceptions: DateException[];
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DateException {
  date: string;
  type: 'unavailable' | 'special';
  slots?: TimeSlot[];
  reason?: string;
}

// Product Upload Flow Types
export type ProductUploadStep =
  | 'type-selection'
  | 'basic-info'
  | 'media'
  | 'pricing'
  | 'variants'
  | 'digital-assets'
  | 'service-config'
  | 'shipping'
  | 'seo'
  | 'review';

export interface ProductUploadState {
  step: ProductUploadStep;
  productType: ProductType | null;
  data: Partial<Product>;
  validationErrors: Record<string, string[]>;
  isSubmitting: boolean;
  isDirty: boolean;
}
