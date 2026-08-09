// Notification settings — mirrors `GET/PATCH /api/vendor/notification-preferences`.
// See api-doc/vendor/notifications.md.

/** The twelve subscribable events (`preferences.*` keys). See api-doc/vendor/notifications.md. */
export type NotificationEventKey =
  | 'orderCreated'
  | 'orderCancelled'
  | 'bookingCreated'
  | 'bookingCancelled'
  | 'paymentReceivedPartial'
  | 'paymentReceivedFull'
  /** Your MEDIA-FILE quota. Unrelated to `agencyStorageUpdates` below. */
  | 'storageAlert'
  | 'connectionUpdated'
  | 'payoutUpdates'
  | 'shipmentRejected'
  | 'planUpdates'
  /**
   * Physical goods an agency warehouses for you: stock requests, depot moves,
   * and storage suspensions. Shares only a word with `storageAlert`.
   */
  | 'agencyStorageUpdates';

export type NotificationEventPreferences = Record<NotificationEventKey, boolean>;

/** The single active secondary delivery channel (in-app is always on, never a value here). */
export type SecondaryChannel = 'email' | 'telegram' | 'whatsapp';

/** Radio-group selection: in-app only, or one secondary channel. */
export type DeliveryChannelChoice = 'in-app' | SecondaryChannel;

/** Shape returned by `GET /api/vendor/notification-preferences`. */
export interface NotificationPreferences {
  /** Always true — cannot be disabled. */
  inAppEnabled: boolean;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  /** Live, read-only verification flags computed from the vendor's account. */
  emailVerified: boolean;
  telegramVerified: boolean;
  whatsappVerified: boolean;
  preferences: NotificationEventPreferences;
}

/** Body for `PATCH /api/vendor/notification-preferences` — all fields optional. */
export interface NotificationPreferencesUpdate {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  whatsappEnabled?: boolean;
  preferences?: Partial<NotificationEventPreferences>;
}

export interface NotificationPreferencesResponse {
  success: boolean;
  data: NotificationPreferences;
  message?: string;
}

/** Languages a vendor can choose for rendered notifications. */
export type PreferredLanguage = 'en' | 'fr' | 'pt' | 'es' | 'ar';

// ─── In-app notification feed ──────────────────────────────────────────────
// The runtime notifications returned by `GET /api/vendor/notifications`.
// Distinct from the *preferences* types above.

/**
 * Notification `type` discriminator. Each subscribable event maps to one or more
 * types — `connectionUpdated` and `payoutUpdates` each fan out to several.
 */
export type NotificationType =
  | 'order.created'
  | 'order.cancelled'
  | 'booking.created'
  | 'booking.cancelled'
  | 'payment.received.partial'
  | 'payment.received.full'
  | 'storage.alert'
  | 'connection.request_received'
  | 'connection.approved'
  | 'connection.rejected'
  | 'connection.reapproval_needed'
  | 'payout.requested'
  | 'payout.paid'
  | 'payout.rejected'
  // A delivery agency declined a shipment; its items move to
  // `pending_agency_reassignment` and must be rerouted. `aggregateType` is `order`.
  | 'shipment.rejected'
  // Billing: the vendor's plan is nearing expiry or has expired (handed over to a
  // queued plan, or downgraded to free `starter`). `aggregateType` is `plan`.
  | 'plan.expiring'
  | 'plan.expired'
  // A stock change on a SKU an agency warehouses for you — the agency proposed
  // one (yours to answer), or answered one you proposed. `aggregateType` is
  // `stock_request`, `aggregateId` the request id. Nothing fires for `withdrawn`.
  | 'storage.stock_request.received'
  | 'storage.stock_request.approved'
  | 'storage.stock_request.rejected'
  // What the storage agency did ALONE to a product it warehouses. There is
  // nothing to approve, but a suspension takes the product OFF the storefront
  // and the agency's note is the only explanation. `aggregateType` is `product`.
  | 'storage.depot_changed'
  | 'storage.product_suspended'
  | 'storage.product_unsuspended';

/** Entity kind a notification points at, for deep-linking. */
export type NotificationAggregateType =
  | 'order'
  | 'booking'
  | 'payment'
  /** The media-file quota — NOT agency warehousing (that is `stock_request`/`product`). */
  | 'storage'
  | 'connection'
  | 'payout'
  | 'plan'
  | 'stock_request'
  | 'product';

/** Channels a notification was actually delivered on. */
export type DeliveredVia = 'in-app' | 'push' | 'telegram' | 'email' | 'whatsapp';

/**
 * Click target for a notification — the deep-link into the dashboard surfaced as
 * a button (in-app and on every secondary channel). Localized in the vendor's
 * language. See api-doc/vendor/notifications.md → "The `action` object".
 */
export interface NotificationAction {
  /** Localized button text, e.g. `"View order"`. */
  label: string;
  /** Backend-relative deep-link, e.g. `"orders/665f…"`. */
  path: string;
  /** Absolute deep-link; present only when the backend has `VENDOR_APP_URL` set. */
  url?: string;
}

/** A single notification from `GET /api/vendor/notifications`. */
export interface VendorNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  aggregateType?: NotificationAggregateType;
  aggregateId?: string;
  /** Click target. `null` for the rare type with no associated screen. */
  action?: NotificationAction | null;
  deliveredVia: DeliveredVia[];
  createdAt: string;
  readAt?: string;
}

export interface NotificationListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Shape returned by `GET /api/vendor/notifications`. */
export interface NotificationListResponse {
  success: boolean;
  data: VendorNotification[];
  unreadCount: number;
  meta: NotificationListMeta;
}

export interface NotificationListParams {
  isRead?: boolean;
  page?: number;
  limit?: number;
}

// ─── Push devices (FCM) ────────────────────────────────────────────────────

/** Platform a registered push device runs on. `web` for the dashboard. */
export type DevicePlatform = 'web' | 'android' | 'ios';

/** Body for `POST /api/vendor/devices`. */
export interface DeviceRegistration {
  token: string;
  platform: DevicePlatform;
  userAgent?: string;
}

// ─── Channel linking flows ─────────────────────────────────────────────────
// See api-doc/vendor/notification-channels.md. A secondary channel must be
// LINKED/VERIFIED (these flows) before it can be ENABLED in preferences.

/** `POST /api/webhooks/telegram/link-token` */
export interface TelegramLinkToken {
  bot_url: string;
  expires_at: string;
}

/** `GET /api/webhooks/telegram/status` */
export interface TelegramStatus {
  linked: boolean;
  isActive: boolean;
  chatId?: string;
  firstName?: string;
  connectedAt?: string;
}

/** `POST /api/webhooks/telegram/toggle` — returns only the new active state. */
export interface TelegramToggleResult {
  is_active: boolean;
}

/** `POST /api/auth/request-wa-verification` */
export interface WhatsappVerification {
  code: string;
  command: string;
  bot_number: string;
  wa_link: string;
  expires_in_seconds: number;
  instructions: string;
}

/** `GET /api/webhooks/whatsapp/link/status` */
export interface WhatsappStatus {
  linked: boolean;
  wa_phone_id?: string;
  name?: string;
  bound_at?: string;
}
